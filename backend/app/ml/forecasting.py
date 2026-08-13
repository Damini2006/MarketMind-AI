import os
import joblib
import pandas as pd

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import LabelEncoder


MODEL_PATH = "app/trained_models/sales_forecast.pkl"
ENCODER_PATH = "app/trained_models/sales_encoder.pkl"


FEATURE_COLUMNS = [
    "Store ID",
    "Product ID",
    "Category",
    "Region",
    "Inventory Level",
    "Units Ordered",
    "Price",
    "Discount",
    "Weather Condition",
    "Promotion",
    "Competitor Pricing",
    "Seasonality",
    "Epidemic",
    "Demand",
    "Year",
    "Month",
    "Day",
]

TARGET_COLUMN = "Units Sold"

CATEGORICAL_COLUMNS = [
    "Store ID",
    "Product ID",
    "Category",
    "Region",
    "Weather Condition",
    "Seasonality",
]


def train_sales_forecast(dataset_path):
    # ----------------------------
    # Load dataset
    # ----------------------------
    df = pd.read_csv(dataset_path)

    # ----------------------------
    # Convert date
    # ----------------------------
    df["Date"] = pd.to_datetime(
        df["Date"],
        dayfirst=True,
        errors="coerce",
    )

    df = df.dropna(subset=["Date"])

    # ----------------------------
    # Create date features
    # ----------------------------
    df["Year"] = df["Date"].dt.year
    df["Month"] = df["Date"].dt.month
    df["Day"] = df["Date"].dt.day

    # ----------------------------
    # Sort chronologically
    # ----------------------------
    df = df.sort_values("Date").reset_index(drop=True)

    # ----------------------------
    # Encode categorical columns
    # ----------------------------
    encoders = {}

    for column in CATEGORICAL_COLUMNS:
        encoder = LabelEncoder()

        df[column] = encoder.fit_transform(
            df[column].astype(str)
        )

        encoders[column] = encoder

    # ----------------------------
    # Features and target
    # ----------------------------
    X = df[FEATURE_COLUMNS].copy()
    y = df[TARGET_COLUMN].copy()

    # ----------------------------
    # Time-based train/test split
    # ----------------------------
    split_index = int(len(df) * 0.8)

    X_train = X.iloc[:split_index]
    X_test = X.iloc[split_index:]

    y_train = y.iloc[:split_index]
    y_test = y.iloc[split_index:]

    # ----------------------------
    # Train Random Forest
    # ----------------------------
    model = RandomForestRegressor(
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
    )

    model.fit(X_train, y_train)

    # ----------------------------
    # Predictions
    # ----------------------------
    predictions = model.predict(X_test)

    # ----------------------------
    # Evaluation metrics
    # ----------------------------
    mae = mean_absolute_error(
        y_test,
        predictions,
    )

    rmse = mean_squared_error(
        y_test,
        predictions,
    ) ** 0.5

    r2 = r2_score(
        y_test,
        predictions,
    )

    # ----------------------------
    # Feature importance
    # ----------------------------
    feature_importance = (
        pd.DataFrame(
            {
                "feature": FEATURE_COLUMNS,
                "importance": model.feature_importances_,
            }
        )
        .sort_values(
            "importance",
            ascending=False,
        )
    )

    # ----------------------------
    # Save model + encoders
    # ----------------------------
    os.makedirs(
        os.path.dirname(MODEL_PATH),
        exist_ok=True,
    )

    joblib.dump(
        model,
        MODEL_PATH,
    )

    joblib.dump(
        encoders,
        ENCODER_PATH,
    )

    # ----------------------------
    # Prediction results
    # ----------------------------
    results = df.iloc[split_index:][
        [
            "Date",
            "Store ID",
            "Product ID",
            "Category",
            "Region",
        ]
    ].copy()

    results["Actual Units Sold"] = y_test.values

    results["Predicted Units Sold"] = (
        predictions.round().astype(int)
    )

    return {
        "model": model,
        "encoders": encoders,
        "results": results,
        "mae": round(float(mae), 2),
        "rmse": round(float(rmse), 2),
        "r2": round(float(r2), 4),
        "feature_importance": feature_importance,
        "train_size": len(X_train),
        "test_size": len(X_test),
    }

def load_sales_forecast_model():
    """Load the trained forecasting model and categorical encoders."""

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Forecast model not found: {MODEL_PATH}"
        )

    if not os.path.exists(ENCODER_PATH):
        raise FileNotFoundError(
            f"Forecast encoders not found: {ENCODER_PATH}"
        )

    model = joblib.load(MODEL_PATH)
    encoders = joblib.load(ENCODER_PATH)

    return model, encoders


def predict_sales(input_data):
    """
    Predict Units Sold from a complete set of model features.

    input_data should contain the same feature names used during training.
    """

    model, encoders = load_sales_forecast_model()

    df = pd.DataFrame([input_data])

    # Encode categorical features using the encoders
    # saved during training.
    for column in CATEGORICAL_COLUMNS:
        if column not in df.columns:
            raise ValueError(
                f"Missing required feature: {column}"
            )

        value = str(df.loc[0, column])

        encoder = encoders[column]

        if value not in encoder.classes_:
            raise ValueError(
                f"Unknown value '{value}' for {column}. "
                f"Known values: {list(encoder.classes_)}"
            )

        df[column] = encoder.transform([value])

    # Make sure every required feature exists.
    missing_features = [
        column
        for column in FEATURE_COLUMNS
        if column not in df.columns
    ]

    if missing_features:
        raise ValueError(
            f"Missing required features: {missing_features}"
        )

    X = df[FEATURE_COLUMNS]

    prediction = model.predict(X)[0]

    return {
        "predicted_units_sold": max(
            0,
            round(float(prediction))
        )
    }


def forecast_future_sales(
    dataset_path,
    horizon_days=14,
):
    """
    Generate future sales forecasts using historical business patterns.

    The Random Forest predicts Units Sold using:
    - product/store information
    - pricing
    - inventory
    - demand
    - promotions
    - competition
    - weather
    - seasonality
    - epidemic conditions
    - calendar features

    Future numeric/categorical inputs are estimated from historical
    observations for the same product/store and similar calendar periods.
    """

    model, encoders = load_sales_forecast_model()

    # ----------------------------
    # Load historical dataset
    # ----------------------------
    df = pd.read_csv(dataset_path)

    df["Date"] = pd.to_datetime(
        df["Date"],
        dayfirst=True,
        errors="coerce",
    )

    df = df.dropna(subset=["Date"]).copy()

    df["Year"] = df["Date"].dt.year
    df["Month"] = df["Date"].dt.month
    df["Day"] = df["Date"].dt.day
    df["DayOfWeek"] = df["Date"].dt.dayofweek

    df = df.sort_values("Date")

    last_date = df["Date"].max()

    # ----------------------------
    # Historical actual sales
    # ----------------------------
    daily_history = (
        df.groupby("Date")["Units Sold"]
        .sum()
        .reset_index()
        .sort_values("Date")
    )

    # ----------------------------
    # Generate future dates
    # ----------------------------
    future_dates = pd.date_range(
        start=last_date + pd.Timedelta(days=1),
        periods=horizon_days,
        freq="D",
    )

    # ----------------------------
    # Store-product combinations
    # ----------------------------
    combinations = (
        df[
            [
                "Store ID",
                "Product ID",
                "Category",
                "Region",
            ]
        ]
        .drop_duplicates(
            subset=["Store ID", "Product ID"]
        )
    )

    future_rows = []

    for future_date in future_dates:

        month = future_date.month
        day = future_date.day
        day_of_week = future_date.dayofweek

        for _, combo in combinations.iterrows():

            store_id = combo["Store ID"]
            product_id = combo["Product ID"]

            # ----------------------------------------
            # Start with same store + product
            # ----------------------------------------
            subset = df[
                (df["Store ID"] == store_id)
                & (df["Product ID"] == product_id)
                & (df["Month"] == month)
                & (df["DayOfWeek"] == day_of_week)
            ]

            # Fallback: same store + product + month
            if subset.empty:
                subset = df[
                    (df["Store ID"] == store_id)
                    & (df["Product ID"] == product_id)
                    & (df["Month"] == month)
                ]

            # Fallback: same product + month
            if subset.empty:
                subset = df[
                    (df["Product ID"] == product_id)
                    & (df["Month"] == month)
                ]

            # Fallback: same month globally
            if subset.empty:
                subset = df[
                    df["Month"] == month
                ]

            # ----------------------------------------
            # Build future feature row
            # ----------------------------------------
            row = {
                "Store ID": store_id,
                "Product ID": product_id,
                "Category": combo["Category"],
                "Region": combo["Region"],
                "Inventory Level": subset[
                    "Inventory Level"
                ].median(),
                "Units Ordered": subset[
                    "Units Ordered"
                ].median(),
                "Price": subset[
                    "Price"
                ].median(),
                "Discount": subset[
                    "Discount"
                ].median(),
                "Weather Condition": subset[
                    "Weather Condition"
                ].mode().iloc[0],
                "Promotion": subset[
                    "Promotion"
                ].mode().iloc[0],
                "Competitor Pricing": subset[
                    "Competitor Pricing"
                ].median(),
                "Seasonality": subset[
                    "Seasonality"
                ].mode().iloc[0],
                "Epidemic": subset[
                    "Epidemic"
                ].mode().iloc[0],
                "Demand": subset[
                    "Demand"
                ].median(),
                "Year": future_date.year,
                "Month": future_date.month,
                "Day": future_date.day,
            }

            future_rows.append(row)

    future_df = pd.DataFrame(future_rows)

    # ----------------------------
    # Encode categorical columns
    # ----------------------------
    for column in CATEGORICAL_COLUMNS:

        encoder = encoders[column]

        future_df[column] = (
            future_df[column]
            .astype(str)
            .map(
                dict(
                    zip(
                        encoder.classes_,
                        encoder.transform(
                            encoder.classes_
                        ),
                    )
                )
            )
        )

    # ----------------------------
    # Check for encoding failures
    # ----------------------------
    if future_df[CATEGORICAL_COLUMNS].isna().any().any():
        raise ValueError(
            "Future forecast contains categorical "
            "values that were not present during training."
        )

    # ----------------------------
    # Predict future units sold
    # ----------------------------
    X_future = future_df[
        FEATURE_COLUMNS
    ]

    predictions = model.predict(
        X_future
    )

    future_df["Predicted Units Sold"] = (
        predictions
        .clip(min=0)
        .round()
        .astype(int)
    )

    future_df["Date"] = future_dates.repeat(
        len(combinations)
    ).values

    # ----------------------------
    # Aggregate by day
    # ----------------------------
    daily_forecast = (
        future_df.groupby("Date")[
            "Predicted Units Sold"
        ]
        .sum()
        .reset_index()
    )

    daily_forecast["Date"] = (
        daily_forecast["Date"]
        .dt.strftime("%Y-%m-%d")
    )

    daily_forecast = daily_forecast.rename(
        columns={
            "Predicted Units Sold":
                "predicted_units_sold"
        }
    )

    # ----------------------------
    # Historical daily totals
    # ----------------------------
    history = daily_history.tail(30).copy()

    history["Date"] = (
        history["Date"]
        .dt.strftime("%Y-%m-%d")
    )

    history = history.rename(
        columns={
            "Units Sold": "units_sold"
        }
    )

    # ----------------------------
    # Return result
    # ----------------------------
    return {
        "last_historical_date":
            last_date.strftime("%Y-%m-%d"),

        "history": history.to_dict(
            orient="records"
        ),

        "forecast":
            daily_forecast.to_dict(
                orient="records"
            ),

        "total_forecast_units":
            int(
                daily_forecast[
                    "predicted_units_sold"
                ].sum()
            ),
    }