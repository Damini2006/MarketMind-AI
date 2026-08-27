import pandas as pd
import joblib
from pathlib import Path
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score


# =============================
# PROJECT PATHS
# =============================

# ML folder
BASE_DIR = Path(__file__).resolve().parent.parent

# Main project folder
PROJECT_DIR = BASE_DIR.parent

# Dataset path
dataset_path = BASE_DIR / "datasets" / "Customer_Data.xlsx"

# Results folder
results_dir = Path(__file__).resolve().parent / "results"
results_dir.mkdir(exist_ok=True)

# Models folder
models_dir = PROJECT_DIR / "models"
models_dir.mkdir(exist_ok=True)


# =============================
# LOAD DATASET
# =============================

print("Dataset path:", dataset_path)

df = pd.read_excel(dataset_path)

print("Customer Dataset Loaded Successfully!\n")
print(df.head())

print("\nDataset Shape:")
print(df.shape)

print("\nMissing Values:")
print(df.isnull().sum())


# =============================
# SELECT FEATURES
# =============================

features = [
    "Purchase_Frequency",
    "Average_Order_Value",
    "Total_Orders",
    "Total_Spent",
    "Days_Since_Last_Purchase"
]

X = df[features]


# =============================
# SCALE DATA
# =============================

scaler = StandardScaler()

X_scaled = scaler.fit_transform(X)

print("\nData Scaling Completed!")


# =============================
# ELBOW METHOD
# =============================

wcss = []

for i in range(1, 11):

    kmeans_temp = KMeans(
        n_clusters=i,
        random_state=42,
        n_init=10
    )

    kmeans_temp.fit(X_scaled)

    wcss.append(kmeans_temp.inertia_)


plt.figure(figsize=(8, 5))
plt.plot(range(1, 11), wcss, marker="o")

plt.title("Elbow Method")
plt.xlabel("Number of Clusters")
plt.ylabel("WCSS")
plt.grid(True)

plt.tight_layout()

plt.savefig(results_dir / "elbow_plot.png")
plt.close()

print("Elbow plot saved successfully!")


# =============================
# TRAIN CUSTOMER SEGMENTATION MODEL
# =============================

kmeans = KMeans(
    n_clusters=4,
    random_state=42,
    n_init=10
)

clusters = kmeans.fit_predict(X_scaled)

df["Cluster"] = clusters

print("\nCustomer Segmentation Completed!")


# =============================
# EVALUATE MODEL
# =============================

score = silhouette_score(X_scaled, clusters)

print(f"\nSilhouette Score: {score:.3f}")


# =============================
# SAVE MODEL
# =============================

joblib.dump(
    kmeans,
    models_dir / "customer_segmentation.pkl"
)

joblib.dump(
    scaler,
    models_dir / "customer_scaler.pkl"
)

print("\nCustomer segmentation model saved successfully!")
print("Model location:", models_dir / "customer_segmentation.pkl")
print("Scaler location:", models_dir / "customer_scaler.pkl")


# =============================
# SAVE CLUSTERED DATA
# =============================

df.to_excel(
    results_dir / "customer_segments.xlsx",
    index=False
)

print("\nClustered Customers Saved!")


# =============================
# CLUSTER COUNT
# =============================

print("\nCustomers in each Cluster:\n")

print(
    df["Cluster"]
    .value_counts()
    .sort_index()
)


# =============================
# CLUSTER SUMMARY
# =============================

print("\nCluster Summary\n")

summary = df.groupby("Cluster")[
    [
        "Purchase_Frequency",
        "Average_Order_Value",
        "Total_Orders",
        "Total_Spent",
        "Days_Since_Last_Purchase"
    ]
].mean()

pd.set_option("display.max_columns", None)
pd.set_option("display.width", None)

print(summary)

summary.to_excel(
    results_dir / "cluster_summary.xlsx"
)

print("\nCluster Summary Saved!")


# =============================
# CUSTOMER CLUSTER VISUALIZATION
# =============================

plt.figure(figsize=(8, 6))

sns.scatterplot(
    data=df,
    x="Average_Order_Value",
    y="Total_Spent",
    hue="Cluster",
    palette="Set2"
)

plt.title("Customer Segments")

plt.tight_layout()

plt.savefig(
    results_dir / "customer_clusters.png"
)

plt.close()

print("Customer Cluster Plot Saved!")


print("\n======================================")
print("CUSTOMER SEGMENTATION COMPLETED!")
print("======================================")