from ml.forecasting import train_sales_forecast

df = train_sales_forecast("app/datasets/sales_data.csv")

print(df.head())