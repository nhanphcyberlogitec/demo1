# core/main.py

from fastapi import FastAPI

# Initialize the FastAPI application
# The 'title' and 'description' are optional but good for documentation (Swagger UI)
app = FastAPI(
    title="Core API",
    description="A simple core API built with FastAPI."
)

# Define a root endpoint
@app.get("/")
async def read_root():
    """
    Returns a simple welcome message.
    """
    return {"message": "Welcome to the Core API!"}

# Define another simple endpoint
@app.get("/items/{item_id}")
async def read_item(item_id: int, q: str | None = None):
    """
    Retrieves an item by its ID.
    
    - **item_id**: The ID of the item (integer).
    - **q**: An optional query string (string).
    """
    if q:
        return {"item_id": item_id, "q": q}
    return {"item_id": item_id}

# You can add more endpoints here as your project grows