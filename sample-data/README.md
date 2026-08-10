# Sample datasets for testing CSV upload

Three ready-to-upload CSVs for testing the **Upload CSV** feature. Each file is
verified against the current backend — all rows import cleanly and the sales
file is automatically logged into the **Datasets** page.

| File | Upload from | What happens | Verified result |
|---|---|---|---|
| `sales_data.csv` | **Sales** page → Upload CSV | Imports 20 sales (products + customers matched by name, dated Aug 1–10 2026) and logs the file into the **Datasets** page | 20 created |
| `customers.csv` | **Customers** page → Upload CSV | Creates 15 new customers | 15 created |
| `products_inventory.csv` | **Inventory** page → Upload CSV | Updates the 12 seeded products (stock/price) and creates 3 new ones (Paper Clips, Almonds, Instant Noodles) | 12 updated + 3 created |

## How to test in the UI

1. Log in (demo: `owner@marketmind.ai` / `Owner@123`).
2. Open the page for the dataset you want to test.
3. Click **Upload CSV** and pick the file from `sample-data/`.
4. Check the result message, then the table — and for sales, the **Datasets**
   page shows the uploaded file with its validation counts.

## Column notes

- Headers are normalized automatically (lowercase, spaces → underscores), so the
  files work as-is.
- **Sales** requires `product_name, quantity, unit_price`; `customer_name` and
  `sale_date` are optional extras used when present.
- **Customers** requires `name`; `email` and `phone` are optional.
- **Inventory** requires `name, price`; `category, stock_quantity,
  reorder_threshold, warehouse_location` are optional. Products are matched by
  name (case/whitespace-insensitive), so re-uploading updates instead of
  duplicating.
