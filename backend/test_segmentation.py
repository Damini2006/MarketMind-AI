# from app.ml.segmentation import train_customer_segmentation

# df = train_customer_segmentation("app/datasets/Customer_Data.xlsx")

# print(df.head())

# print(df["Cluster"].value_counts())

from ml.segmentation import train_customer_segmentation

df = train_customer_segmentation("app/datasets/Customer_Data.xlsx")

print(df[["Customer_Name", "Total_Spent", "Cluster", "Segment"]].head())

print("\nSegment Counts:")
print(df["Segment"].value_counts())