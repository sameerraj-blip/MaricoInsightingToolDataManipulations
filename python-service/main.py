"""FastAPI application for Data Operations Service"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal
import uvicorn
from config import config
from data_operations import remove_nulls, get_preview, get_summary, convert_type, create_derived_column
import traceback

app = FastAPI(title="Data Operations Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class RemoveNullsRequest(BaseModel):
    data: List[Dict[str, Any]]
    column: Optional[str] = None
    method: Literal["delete", "mean", "median", "mode", "custom"] = "delete"
    custom_value: Optional[Any] = None


class PreviewRequest(BaseModel):
    data: List[Dict[str, Any]]
    limit: int = Field(default=50, ge=1, le=10000)


class CreateDerivedColumnRequest(BaseModel):
    data: List[Dict[str, Any]]
    new_column_name: str
    expression: str


class ConvertTypeRequest(BaseModel):
    data: List[Dict[str, Any]]
    column: str
    target_type: Literal["numeric", "string", "date", "percentage", "boolean"]


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "data-ops"}


@app.post("/remove-nulls")
async def remove_nulls_endpoint(request: RemoveNullsRequest):
    """Remove null values from data"""
    try:
        if len(request.data) > config.MAX_ROWS:
            raise HTTPException(
                status_code=400,
                detail=f"Data exceeds maximum rows limit of {config.MAX_ROWS}"
            )
        
        result = remove_nulls(
            data=request.data,
            column=request.column,
            method=request.method,
            custom_value=request.custom_value
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error in remove_nulls: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/preview")
async def preview_endpoint(request: PreviewRequest):
    """Get data preview"""
    try:
        if len(request.data) > config.MAX_ROWS:
            raise HTTPException(
                status_code=400,
                detail=f"Data exceeds maximum rows limit of {config.MAX_ROWS}"
            )
        
        if request.limit > config.MAX_PREVIEW_ROWS:
            request.limit = config.MAX_PREVIEW_ROWS
        
        result = get_preview(data=request.data, limit=request.limit)
        return result
    except Exception as e:
        print(f"Error in preview: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/summary")
async def summary_endpoint(request: Dict[str, Any]):
    """Get data summary statistics (all columns or a specific column)"""
    try:
        data = request.get("data", [])
        column = request.get("column")  # Optional column name
        if not isinstance(data, list):
            raise HTTPException(status_code=400, detail="Data must be a list")
        
        if len(data) > config.MAX_ROWS:
            raise HTTPException(
                status_code=400,
                detail=f"Data exceeds maximum rows limit of {config.MAX_ROWS}"
            )
        
        result = get_summary(data=data, column=column)
        return result
    except Exception as e:
        print(f"Error in summary: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/create-derived-column")
async def create_derived_column_endpoint(request: CreateDerivedColumnRequest):
    """Create a new column from an expression"""
    try:
        if len(request.data) > config.MAX_ROWS:
            raise HTTPException(
                status_code=400,
                detail=f"Data exceeds maximum rows limit of {config.MAX_ROWS}"
            )
        
        result = create_derived_column(
            data=request.data,
            new_column_name=request.new_column_name,
            expression=request.expression
        )
        
        if result.get("errors") and len(result["errors"]) > 0:
            raise HTTPException(
                status_code=400,
                detail="; ".join(result["errors"])
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in create_derived_column: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/convert-type")
async def convert_type_endpoint(request: ConvertTypeRequest):
    """Convert column data type"""
    try:
        if len(request.data) > config.MAX_ROWS:
            raise HTTPException(
                status_code=400,
                detail=f"Data exceeds maximum rows limit of {config.MAX_ROWS}"
            )
        
        result = convert_type(
            data=request.data,
            column=request.column,
            target_type=request.target_type
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error in convert_type: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    print(f"Unhandled exception: {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True
    )

