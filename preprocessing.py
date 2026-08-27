import pandas as pd
import matplotlib.pyplot as plt

# Read the Excel file
inventory = pd.read_excel("datasets/supply_chain_dataset1.xlsx")

# Display the first 5 rows
print("===== First 5 Rows =====")
print(inventory.head())

# Dataset information
print("\n===== Dataset Information =====")
inventory.info()

# Check missing values
print("\n===== Missing Values =====")
print(inventory.isnull().sum())

# Check duplicate rows
print("\n===== Duplicate Rows =====")
print(inventory.duplicated().sum())

# Display data types
print("\n===== Data Types =====")
print(inventory.dtypes)

# Statistical summary
print("\n===== Statistical Summary =====")
print(inventory.describe())
# Boxplot for Inventory Level
inventory.boxplot(column="Inventory_Level")
plt.title("Inventory Level Boxplot")
plt.ylabel("Inventory Level")
plt.show()
# Convert date format
inventory["Date"] = inventory["Date"].dt.strftime("%d-%m-%Y")
# Save cleaned dataset
inventory.to_excel("cleaned_data/clean_inventory.xlsx", index=False)

print("Cleaned dataset saved successfully!")