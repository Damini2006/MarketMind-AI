#!/usr/bin/env bash
# Verifies backend/Dockerfile honours $PORT (Railway and Render both inject one)
# while still defaulting to 8000 (compose/CI), and that ENVIRONMENT=production
# boots with a strong secret.
set -u

IMG=marketmind-backend:portcheck
SECRET=$(python -c "import secrets;print('A'*48)" 2>/dev/null || printf 'A%.0s' $(seq 1 48))
FAIL=0
PG=mmverify-pg
NET=mmverify

cleanup() {
  docker rm -f mmpa mmpb "$PG" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup
docker network create "$NET" >/dev/null

echo "--- starting throwaway postgres (pgvector/pgvector:pg16, already local) ---"
docker run -d --name "$PG" --network "$NET" \
  -e POSTGRES_USER=mm -e POSTGRES_PASSWORD=mm -e POSTGRES_DB=mm \
  pgvector/pgvector:pg16 >/dev/null

for i in $(seq 1 30); do
  if docker exec "$PG" pg_isready -U mm -d mm >/dev/null 2>&1; then
    echo "postgres ready after ${i}s"; break
  fi
  sleep 1
done

DBURL='postgresql://mm:mm@'"$PG"':5432/mm'

boot() {
  # $1 = container name, $2 = host port, $3 = container port, $4... = extra -e
  # Host and container ports are separate on purpose: the host port must be a
  # free one (8000 is already taken by the dev stack), and a failed `docker run`
  # must be caught rather than silently hitting whatever already listens there.
  name=$1; hostport=$2; cport=$3; shift 3
  if ! docker run -d --name "$name" --network "$NET" \
    -e ENVIRONMENT=production \
    -e JWT_SECRET_KEY="$SECRET" \
    -e DATABASE_URL="$DBURL" \
    -e CORS_ORIGINS=http://localhost:3000 \
    "$@" -p "${hostport}:${cport}" "$IMG" >/dev/null; then
    echo "  FAIL  ${name}: docker run failed (see error above) — NOT a pass"
    return 1
  fi
  for i in $(seq 1 40); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${hostport}/health" 2>/dev/null)
    if [ "$code" = "200" ]; then
      body=$(curl -s "http://localhost:${hostport}/health")
      echo "  PASS  ${name}: http://localhost:${hostport}/health -> ${code} ${body}"
      return 0
    fi
    if ! docker ps --format '{{.Names}}' | grep -qx "$name"; then
      echo "  FAIL  ${name}: container exited before serving. Logs:"
      docker logs "$name" 2>&1 | tail -15
      return 1
    fi
    sleep 1
  done
  echo "  FAIL  ${name}: never answered on ${hostport}. Logs:"
  docker logs "$name" 2>&1 | tail -15
  return 1
}

echo "--- A) default: no PORT set -> image default 8000 (host 8822) ---"
boot mmpa 8822 8000 || FAIL=1

echo "--- B) injected: PORT=10000, what a PaaS injects (host 8833) ---"
boot mmpb 8833 10000 -e PORT=10000 || FAIL=1

echo "--- confirm each container really listens on its own \$PORT ---"
for pair in "mmpa 8000" "mmpb 10000"; do
  set -- $pair
  got=$(docker exec "$1" sh -c 'curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/health' 2>/dev/null)
  if [ "$got" = "200" ]; then
    echo "  PASS  $1: in-container \$PORT=$2/health -> ${got}"
  else
    echo "  FAIL  $1: in-container \$PORT=$2/health -> '${got}'"
    FAIL=1
  fi
done

echo
if [ "$FAIL" -eq 0 ]; then echo "RESULT: PASS (both ports served, production mode)"; else echo "RESULT: FAIL"; fi
exit "$FAIL"
