In phase 1, we pull the data
In phase 2, we want to define the API

# Requirement
- User can add the store to monitor
- User can view the product of the store
- In each product, user can see the history price
- User can query the data by time range
    - product price
    - average product price by tag
    - average product price by tag, by store
    - average product price by store
- User can review the changelogs of its monitoring stores
    - product price
    - average product price by store
    - average product price by store and tag
    - average product price by tag

---

# REST API Design

## Base URL
```
http://localhost:3000/api/v1
```

## 1. Store Management

### Add Store to Monitor
```http
POST /stores
```

**Request Body:**
```json
{
  "store_url": "https://mous.co",
  "store_name": "Mous",
  "polling_interval": 60
}
```

**Response (201 Created):**
```json
{
  "store_id": "507f1f77bcf86cd799439011",
  "store_url": "https://mous.co",
  "store_name": "Mous",
  "active": true,
  "polling_interval": 60,
  "created_at": "2025-01-15T10:00:00Z"
}
```

### List Stores
```http
GET /stores
```

**Response (200 OK):**
```json
[
  {
    "store_id": "507f1f77bcf86cd799439011",
    "store_url": "https://mous.co",
    "store_name": "Mous",
    "active": true,
    "polling_interval": 60,
    "created_at": "2025-01-15T10:00:00Z",
    "last_polled_at": "2025-01-15T11:30:00Z"
  }
]
```

## 2. View Products

### Get Products by Store
```http
GET /stores/:storeId/products
```

**Response (200 OK):**
```json
[
  {
    "product_id": 6655824986170,
    "store_id": "507f1f77bcf86cd799439011",
    "handle": "iphone-15-pro-max-case",
    "title": "iPhone 15 Pro Max Case",
    "product_type": "Phone Cases",
    "vendor": "Mous",
    "tags": ["iPhone", "Case", "Pro Max"],
    "main_image_url": "https://...",
    "variants": [
      {
        "variant_id": 39491972595770,
        "variant_title": "Black - Aramid Fibre",
        "price": 49.99,
        "previous_price": 54.99,
        "image_url": "https://..."
      }
    ],
    "created_at": "2024-11-01T10:00:00Z",
    "updated_at": "2025-01-15T11:30:00Z"
  }
]
```

## 3. Price History

### Get Product Price History
```http
GET /products/:productId/price-history
```

**Query Parameters:**
- `start_date` (optional): ISO 8601 date
- `end_date` (optional): ISO 8601 date

**Response (200 OK):**
```json
{
  "product_id": 6655824986170,
  "product_title": "iPhone 15 Pro Max Case",
  "variants": [
    {
      "variant_id": 39491972595770,
      "variant_title": "Black - Aramid Fibre",
      "price_history": [
        {
          "price": 59.99,
          "recorded_at": "2025-01-01T10:00:00Z"
        },
        {
          "price": 54.99,
          "recorded_at": "2025-01-15T10:00:00Z"
        },
        {
          "price": 49.99,
          "recorded_at": "2025-02-01T10:00:00Z"
        }
      ]
    }
  ]
}
```

## 4. Analytics - Time Range Queries

### Get Average Price by Store (Time Series)
```http
GET /analytics/stores/:storeId/average-price
```

**Query Parameters:**
- `start_date` (required): ISO 8601 date
- `end_date` (required): ISO 8601 date
- `window_hours` (required): Number of hours per time window (minimum: 1)

**Response (200 OK):**
```json
{
  "store_id": "507f1f77bcf86cd799439011",
  "store_name": "Mous",
  "window_hours": 24,
  "time_range": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-01-31T23:59:59Z"
  },
  "data": [
    {
      "price": 51.20,
      "window_start": "2025-01-01T00:00:00Z",
      "window_end": "2025-01-02T00:00:00Z"
    },
    {
      "price": 50.85,
      "window_start": "2025-01-02T00:00:00Z",
      "window_end": "2025-01-03T00:00:00Z"
    },
    {
      "price": 48.50,
      "window_start": "2025-01-15T00:00:00Z",
      "window_end": "2025-01-16T00:00:00Z"
    },
    {
      "price": 47.85,
      "window_start": "2025-01-31T00:00:00Z",
      "window_end": "2025-02-01T00:00:00Z"
    }
  ]
}
```

### Get Average Price by Tag (Time Series)
```http
GET /analytics/tags/:tag/average-price
```

**Query Parameters:**
- `start_date` (required): ISO 8601 date
- `end_date` (required): ISO 8601 date
- `window_hours` (required): Number of hours per time window (minimum: 1)

**Response (200 OK):**
```json
{
  "tag": "iPhone",
  "window_hours": 24,
  "time_range": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-01-31T23:59:59Z"
  },
  "data": [
    {
      "price": 55.10,
      "window_start": "2025-01-01T00:00:00Z",
      "window_end": "2025-01-02T00:00:00Z"
    },
    {
      "price": 52.30,
      "window_start": "2025-01-15T00:00:00Z",
      "window_end": "2025-01-16T00:00:00Z"
    },
    {
      "price": 51.50,
      "window_start": "2025-01-31T00:00:00Z",
      "window_end": "2025-02-01T00:00:00Z"
    }
  ]
}
```

### Get Average Price by Tag and Store (Time Series)
```http
GET /analytics/stores/:storeId/tags/:tag/average-price
```

**Query Parameters:**
- `start_date` (required): ISO 8601 date
- `end_date` (required): ISO 8601 date
- `window_hours` (required): Number of hours per time window (minimum: 1)

**Response (200 OK):**
```json
{
  "store_id": "507f1f77bcf86cd799439011",
  "store_name": "Mous",
  "tag": "iPhone",
  "window_hours": 24,
  "time_range": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-01-31T23:59:59Z"
  },
  "data": [
    {
      "price": 55.10,
      "window_start": "2025-01-01T00:00:00Z",
      "window_end": "2025-01-02T00:00:00Z"
    },
    {
      "price": 52.30,
      "window_start": "2025-01-15T00:00:00Z",
      "window_end": "2025-01-16T00:00:00Z"
    },
    {
      "price": 51.50,
      "window_start": "2025-01-31T00:00:00Z",
      "window_end": "2025-02-01T00:00:00Z"
    }
  ]
}
```

## 5. Changelogs

### Product Price Changelogs
```http
GET /changelogs/products
```

**Query Parameters:**
- `store_id` (optional): Filter by store
- `start_date` (optional): ISO 8601 date
- `end_date` (optional): ISO 8601 date
- `window_hours` (required): Number of hours per time window (minimum: 1)

**Response (200 OK):**
```json
[
  {
    "product_id": 6655824986170,
    "product_title": "iPhone 15 Pro Max Case",
    "store_id": "507f1f77bcf86cd799439011",
    "store_name": "Mous",
    "variant_id": 39491972595770,
    "variant_title": "Black - Aramid Fibre",
    "window_hours": 24,
    "data": [
      {
        "price": 59.99,
        "window_start": "2025-01-01T00:00:00Z",
        "window_end": "2025-01-02T00:00:00Z"
      },
      {
        "price": 54.99,
        "window_start": "2025-01-15T00:00:00Z",
        "window_end": "2025-01-16T00:00:00Z"
      },
      {
        "price": 49.99,
        "window_start": "2025-02-01T00:00:00Z",
        "window_end": "2025-02-02T00:00:00Z"
      }
    ]
  }
]
```

### Average Price by Store Changelogs
```http
GET /changelogs/stores/average-price
```

**Query Parameters:**
- `store_id` (optional): Filter by specific store
- `start_date` (optional): ISO 8601 date
- `end_date` (optional): ISO 8601 date
- `window_hours` (required): Number of hours per time window (minimum: 1)

**Response (200 OK):**
```json
[
  {
    "store_id": "507f1f77bcf86cd799439011",
    "store_name": "Mous",
    "window_hours": 24,
    "data": [
      {
        "price": 51.20,
        "window_start": "2025-01-01T00:00:00Z",
        "window_end": "2025-01-02T00:00:00Z"
      },
      {
        "price": 50.85,
        "window_start": "2025-01-02T00:00:00Z",
        "window_end": "2025-01-03T00:00:00Z"
      },
      {
        "price": 48.50,
        "window_start": "2025-01-15T00:00:00Z",
        "window_end": "2025-01-16T00:00:00Z"
      }
    ]
  }
]
```

### Average Price by Tag Changelogs
```http
GET /changelogs/tags/average-price
```

**Query Parameters:**
- `tag` (required): Tag name
- `store_id` (optional): Filter by specific store
- `start_date` (optional): ISO 8601 date
- `end_date` (optional): ISO 8601 date
- `window_hours` (required): Number of hours per time window (minimum: 1)

**Response (200 OK):**
```json
[
  {
    "tag": "iPhone",
    "window_hours": 24,
    "data": [
      {
        "price": 55.10,
        "window_start": "2025-01-01T00:00:00Z",
        "window_end": "2025-01-02T00:00:00Z"
      },
      {
        "price": 52.30,
        "window_start": "2025-01-15T00:00:00Z",
        "window_end": "2025-01-16T00:00:00Z"
      },
      {
        "price": 51.50,
        "window_start": "2025-01-31T00:00:00Z",
        "window_end": "2025-02-01T00:00:00Z"
      }
    ]
  }
]
```

### Average Price by Store and Tag Changelogs
```http
GET /changelogs/stores/:storeId/tags/:tag/average-price
```

**Query Parameters:**
- `start_date` (optional): ISO 8601 date
- `end_date` (optional): ISO 8601 date
- `window_hours` (required): Number of hours per time window (minimum: 1)

**Response (200 OK):**
```json
{
  "store_id": "507f1f77bcf86cd799439011",
  "store_name": "Mous",
  "tag": "iPhone",
  "window_hours": 24,
  "data": [
    {
      "price": 55.10,
      "window_start": "2025-01-01T00:00:00Z",
      "window_end": "2025-01-02T00:00:00Z"
    },
    {
      "price": 52.30,
      "window_start": "2025-01-15T00:00:00Z",
      "window_end": "2025-01-16T00:00:00Z"
    },
    {
      "price": 51.50,
      "window_start": "2025-01-31T00:00:00Z",
      "window_end": "2025-02-01T00:00:00Z"
    }
  ]
}
```
