import pandas as pd
import numpy as np
from pathlib import Path
import joblib
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# ==========================================
# PROJECT PATHS
# ==========================================

# ML folder
BASE_DIR = Path(__file__).resolve().parent.parent

# Main project folder
PROJECT_DIR = BASE_DIR.parent

# Dataset path
dataset_path = BASE_DIR / "datasets" / "sales_data.csv"

# Results folder
results_dir = Path(__file__).resolve().parent / "results"
results_dir.mkdir(exist_ok=True)

# Models folder at project root
models_dir = PROJECT_DIR / "models"
models_dir.mkdir(exist_ok=True)


# ==========================================
# LOAD DATASET
# ==========================================

print("==================================================")
print("MARKETMIND AI - SALES FORECASTING MODEL")
print("==================================================")

print("\nDataset path:", dataset_path)

df = pd.read_csv(dataset_path)

print("\nSales Dataset Loaded Successfully!")

print("\n========== First 5 Rows ==========")
print(df.head())

print("\n========== Dataset Shape ==========")
print(df.shape)

print("\n========== Column Names ==========")
print(df.columns.tolist())

print("\n========== Dataset Information ==========")
df.info()

print("\n========== Missing Values ==========")
print(df.isnull().sum())

print("\n========== Statistical Summary ==========")
print(df.describe())


# ==========================================
# DATE PREPROCESSING
# ==========================================

df["Date"] = pd.to_datetime(df["Date"])

# Extract useful date features
df["Year"] = df["Date"].dt.year
df["Month"] = df["Date"].dt.month
df["Day"] = df["Date"].dt.day
df["DayOfWeek"] = df["Date"].dt.dayofweek

# Remove original Date column
df.drop("Date", axis=1, inplace=True)

print("\nDate converted and features extracted successfully!")


# ==========================================
# ENCODE CATEGORICAL COLUMNS
# ==========================================

categorical_columns = [
    "Store ID",
    "Product ID",
    "Category",
    "Region",
    "Weather Condition",
    "Promotion",
    "Seasonality",
    "Epidemic"
]

# Use a separate LabelEncoder for each column
encoders = {}

for column in categorical_columns:
    encoder = LabelEncoder()
    df[column] = encoder.fit_transform(df[column])
    encoders[column] = encoder

print("\nCategorical columns encoded successfully!")


# ==========================================
# SELECT FEATURES AND TARGET
# ==========================================

X = df.drop("Demand", axis=1)
y = df["Demand"]

print("\nFeatures and target selected successfully!")
print("Number of features:", X.shape[1])


# ==========================================
# SPLIT DATA
# ==========================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

print("\nTraining set:", X_train.shape)
print("Testing set:", X_test.shape)


# ==========================================
# TRAIN RANDOM FOREST MODEL
# ==========================================

model = RandomForestRegressor(
    n_estimators=100,
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)

print("\nSales forecasting model trained successfully!")


# ==========================================
# MAKE PREDICTIONS
# ==========================================

y_pred = model.predict(X_test)

print("\nPredictions completed!")


# ==========================================
# MODEL EVALUATION
# ==========================================

mae = mean_absolute_error(y_test, y_pred)
mse = mean_squared_error(y_test, y_pred)
rmse = np.sqrt(mse)
r2 = r2_score(y_test, y_pred)

print("\n========== MODEL EVALUATION ==========")
print(f"Mean Absolute Error (MAE): {mae:.2f}")
print(f"Mean Squared Error (MSE): {mse:.2f}")
print(f"Root Mean Squared Error (RMSE): {rmse:.2f}")
print(f"R² Score: {r2:.4f}")


# ==========================================
# SAVE MODEL
# ==========================================

model_path = models_dir / "sales_forecasting.pkl"

joblib.dump(model, model_path)

print("\nModel saved successfully!")
print("Model location:", model_path)


# ==========================================
# FEATURE IMPORTANCE
# ==========================================

importance = model.feature_importances_

feature_importance = pd.DataFrame({
    "Feature": X.columns,
    "Importance": importance
})

feature_importance = feature_importance.sort_values(
    by="Importance",
    ascending=False
)

print("\n========== FEATURE IMPORTANCE ==========")
print(feature_importance)


# Save feature importance CSV
feature_importance.to_csv(
    results_dir / "feature_importance.csv",
    index=False
)


# Feature importance graph
plt.figure(figsize=(10, 6))

plt.barh(
    feature_importance["Feature"],
    feature_importance["Importance"]
)

plt.xlabel("Importance")
plt.ylabel("Features")
plt.title("Feature Importance for Sales Demand Prediction")

plt.gca().invert_yaxis()

plt.tight_layout()

plt.savefig(
    results_dir / "feature_importance.png"
)

plt.close()

print("\nFeature importance graph saved successfully!")


# ==========================================
# ACTUAL VS PREDICTED GRAPH
# ==========================================

plt.figure(figsize=(8, 6))

plt.scatter(
    y_test,
    y_pred,
    alpha=0.6
)

# Add ideal prediction line
min_value = min(y_test.min(), y_pred.min())
max_value = max(y_test.max(), y_pred.max())

plt.plot(
    [min_value, max_value],
    [min_value, max_value]
)

plt.xlabel("Actual Demand")
plt.ylabel("Predicted Demand")
plt.title("Actual vs Predicted Demand")

plt.tight_layout()

plt.savefig(
    results_dir / "prediction_plot.png"
)

plt.close()

print("Prediction plot saved successfully!")


# ==========================================
# SAVE METRICS
# ==========================================

metrics = pd.DataFrame({
    "Metric": [
        "MAE",
        "MSE",
        "RMSE",
        "R2 Score"
    ],
    "Value": [
        mae,
        mse,
        rmse,
        r2
    ]
})

metrics.to_csv(
    results_dir / "sales_model_metrics.csv",
    index=False
)

print("Model metrics saved successfully!")


# ==========================================
# COMPLETION MESSAGE
# ==========================================

print("\n==================================================")
print("SALES FORECASTING MODEL COMPLETED SUCCESSFULLY!")
print("==================================================")

print("\nGenerated files:")
print("Model:", model_path)
print("Feature Importance:", results_dir / "feature_importance.csv")
print("Feature Graph:", results_dir / "feature_importance.png")
print("Prediction Plot:", results_dir / "prediction_plot.png")
print("Metrics:", results_dir / "sales_model_metrics.csv")