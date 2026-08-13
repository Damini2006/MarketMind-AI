from fastapi import APIRouter
from ml.segmentation import train_customer_segmentation

router = APIRouter(
    prefix="/api/segmentation",
    tags=["Customer Segmentation"]
)


@router.get("")
def get_customer_segments():
    """
    Train the customer segmentation model and
    return segmented customer data.
    """

    df = train_customer_segmentation("app/datasets/Customer_Data.xlsx")

    return df[
        [
            "Customer_Name",
            "Membership_Type",
            "Total_Spent",
            "Segment"
        ]
    ].to_dict(orient="records")