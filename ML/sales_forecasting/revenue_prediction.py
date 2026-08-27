import pandas as pd
import numpy as np
import joblib
from pathlib import Path
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# ==========================================
# 1. SET PROJECT PATHS
# ==========================================

# Current folder: ML/sales_forecasting
CURRENT_DIR = Path(__file__).resolve().parent

# ML folder
ML_DIR = CURRENT_DIR.parent

# Main project folder
PROJECT_DIR = ML_DIR.parent

# Dataset path
dataset_path = ML_DIR / "datasets" / "sales_data.csv"

# Models folder at main project root
models_dir = PROJECT_DIR / "models"

# Results folder
results_dir = CURRENT_DIR / "results"

# Create folders if they do not exist
models_dir.mkdir(exist_ok=True)
results_dir.mkdir(exist_ok=True)


# ==========================================
# 2. LOAD DATASET
# ==========================================

print("=" * 50)
print("MARKETMIND AI - REVENUE PREDICTION MODEL")
print("=" * 50)

print("\nDataset path:", dataset_path)

df = pd.read_csv(dataset_path)

print("\nDATASET LOADED SUCCESSFULLY!")

print("\nDATASET COLUMNS:")
print(df.columns.tolist())

print("\nDATASET SHAPE:")
print(df.shape)

print("\nFIRST 5 ROWS:")
print(df.head())


# ==========================================
# 3. CREATE REVENUE TARGET
# ==========================================

# Revenue = Units Sold × Price
df["Revenue"] = df["Units Sold"] * df["Price"]

print("\nREVENUE COLUMN CREATED SUCCESSFULLY!")

print("\nREVENUE SAMPLE:")
print(df[["Units Sold", "Price", "Revenue"]].head())


# ==========================================
# 4. SELECT FEATURES AND TARGET
# ==========================================

features = [
    "Category",
    "Region",
    "Seasonality",
    "Demand",
    "Price",
    "Promotion"
]

target = "Revenue"

# Check required columns
missing_columns = [
    column for column in features
    if column not in df.columns
]

if missing_columns:
    print("\nERROR: These columns are missing:")
    print(missing_columns)
    print("\nAvailable columns are:")
    print(df.columns.tolist())
    raise ValueError("Required columns are missing from dataset.")

X = df[features]
y = df[target]

print("\nFEATURES USED:")
print(features)

print("\nTARGET:")
print(target)


# ==========================================
# 5. HANDLE CATEGORICAL FEATURES
# ==========================================

categorical_features = [
    "Category",
    "Region",
    "Seasonality",
    "Promotion"
]

numerical_features = [
    "Demand",
    "Price"
]

preprocessor = ColumnTransformer(
    transformers=[
        (
            "categorical",
            OneHotEncoder(handle_unknown="ignore"),
            categorical_features
        ),
        (
            "numerical",
            "passthrough",
            numerical_features
        )
    ]
)


# ==========================================
# 6. SPLIT DATA
# ==========================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

print("\nDATA SPLIT COMPLETED!")
print("Training samples:", X_train.shape[0])
print("Testing samples:", X_test.shape[0])


# ==========================================
# 7. CREATE REVENUE PREDICTION MODEL
# ==========================================

revenue_model = RandomForestRegressor(
    n_estimators=100,
    random_state=42,
    n_jobs=-1
)

pipeline = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        ("model", revenue_model)
    ]
)


# ==========================================
# 8. TRAIN MODEL
# ==========================================

print("\nTRAINING REVENUE PREDICTION MODEL...")

pipeline.fit(X_train, y_train)

print("REVENUE PREDICTION MODEL TRAINED SUCCESSFULLY!")


# ==========================================
# 9. MAKE PREDICTIONS
# ==========================================

predictions = pipeline.predict(X_test)


# ==========================================
# 10. EVALUATE MODEL
# ==========================================

mae = mean_absolute_error(y_test, predictions)

rmse = np.sqrt(
    mean_squared_error(y_test, predictions)
)

r2 = r2_score(y_test, predictions)

print("\n" + "=" * 50)
print("MODEL PERFORMANCE")
print("=" * 50)

print(f"MAE: ₹{mae:,.2f}")
print(f"RMSE: ₹{rmse:,.2f}")
print(f"R² Score: {r2:.4f}")


# ==========================================
# 11. SAVE MODEL
# ==========================================

model_path = models_dir / "revenue_prediction.pkl"

joblib.dump(pipeline, model_path)

print("\nMODEL SAVED SUCCESSFULLY!")
print("Model location:", model_path)


# ==========================================
# 12. SAVE PREDICTION RESULTS
# ==========================================

prediction_results = X_test.copy()

prediction_results["Actual Revenue"] = y_test
prediction_results["Predicted Revenue"] = predictions

prediction_results["Difference"] = (
    prediction_results["Actual Revenue"]
    - prediction_results["Predicted Revenue"]
)

results_path = results_dir / "revenue_predictions.csv"

prediction_results.to_csv(
    results_path,
    index=False
)

print("\nPREDICTION RESULTS SAVED SUCCESSFULLY!")
print("Results location:", results_path)


# ==========================================
# 13. SAVE MODEL METRICS
# ==========================================

metrics = pd.DataFrame({
    "Metric": [
        "MAE",
        "RMSE",
        "R2 Score"
    ],
    "Value": [
        mae,
        rmse,
        r2
    ]
})

metrics_path = results_dir / "revenue_model_metrics.csv"

metrics.to_csv(
    metrics_path,
    index=False
)

print("\nMODEL METRICS SAVED SUCCESSFULLY!")


# ==========================================
# 14. ACTUAL VS PREDICTED GRAPH
# ==========================================

plt.figure(figsize=(10, 6))

plt.scatter(
    y_test,
    predictions,
    alpha=0.6
)

plt.xlabel("Actual Revenue")
plt.ylabel("Predicted Revenue")
plt.title("Actual Revenue vs Predicted Revenue")

# Ideal prediction reference line
minimum = min(y_test.min(), predictions.min())
maximum = max(y_test.max(), predictions.max())

plt.plot(
    [minimum, maximum],
    [minimum, maximum]
)

plt.tight_layout()

graph_path = results_dir / "revenue_prediction.png"

plt.savefig(graph_path)
plt.close()

print("\nREVENUE PREDICTION GRAPH SAVED SUCCESSFULLY!")


# ==========================================
# 15. SAMPLE FUTURE PREDICTION
# ==========================================

print("\n" + "=" * 50)
print("SAMPLE REVENUE PREDICTION")
print("=" * 50)

new_data = pd.DataFrame({
    "Category": ["Groceries"],
    "Region": ["North"],
    "Seasonality": ["Winter"],
    "Demand": [150],
    "Price": [80],
    "Promotion": ["Yes"]
})

predicted_revenue = pipeline.predict(new_data)

print("\nSample Input:")
print(new_data)

print(
    f"\nPREDICTED REVENUE: "
    f"₹{predicted_revenue[0]:,.2f}"
)


# ==========================================
# COMPLETION MESSAGE
# ==========================================

print("\n" + "=" * 50)
print("REVENUE PREDICTION COMPLETED SUCCESSFULLY!")
print("=" * 50)

print("\nGenerated files:")
print("Model:", model_path)
print("Predictions:", results_path)
print("Metrics:", metrics_path)
print("Graph:", graph_path)