import joblib
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
MODELS_DIR = PROJECT_DIR / "models"

# Sales model
print("Compressing sales model...")
sales_model = joblib.load(MODELS_DIR / "sales_forecasting.pkl")

joblib.dump(
    sales_model,
    MODELS_DIR / "sales_forecasting_compressed.pkl",
    compress=5
)

# Revenue model
print("Compressing revenue model...")
revenue_model = joblib.load(MODELS_DIR / "revenue_prediction.pkl")

joblib.dump(
    revenue_model,
    MODELS_DIR / "revenue_prediction_compressed.pkl",
    compress=9
)

print("Compression completed successfully!")