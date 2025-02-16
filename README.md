# 🛋️ Furniture E-Commerce Platform

## 📌 Overview

This project is a **full-stack furniture e-commerce platform** designed for users to browse, purchase, and manage furniture products efficiently. It includes **authentication, product management, order processing, notifications, messaging, and more**, with separate user roles for **customers, admins, and super admins**.

---

## 📦 Tech Stack

### 🖥️ Backend

Built with **Node.js and Express.js**, the backend handles **authentication, product management, order processing, notifications, messaging, and user roles**.

- **Database:** MongoDB with Mongoose
- **Authentication & Security:** JWT, bcrypt, helmet, cookie-parser
- **File Uploads:** express-fileupload
- **Middleware:** body-parser, cors, dotenv

#### 📂 API Endpoints

##### 🔑 User Management (`/user`)

- `POST /signup` - Register a new user
- `POST /login` - Authenticate user and return JWT
- `POST /logout` - Log out the user
- `PUT /update-profile` - Update user profile information
- `POST /add-admin` - Add a new admin (Super Admin only)
- `POST /add-email` - Add an email to a user's account
- `PUT /change-password` - Change user password
- `GET /stats` - Retrieve user statistics
- `GET /data/:id` - Fetch user data by ID
- `GET /get-all/:p?` - Retrieve paginated list of users

##### 🛒 Product Management (`/product`)

- `GET /stats` - Get product statistics
- `GET /latest-sales/:p?` - Retrieve latest sales with pagination
- `GET /:status/:p?` - Fetch products based on status
- `GET /:p?` - Get all products with pagination
- `GET /orders/:p?` - Fetch orders with pagination
- `POST /add` - Add a new product
- `GET /:id` - Get a product by ID
- `PUT /:id` - Update product details
- `POST /:id/images` - Upload product images
- `DELETE /:id` - Delete a product

##### 🔔 Notifications (`/notification`)

- `GET /:p?` - Fetch notifications with pagination

##### 📩 Messaging System (`/message`)

- `GET /:p?` - Retrieve messages with pagination
- `POST /add` - Send a new message
- `DELETE /delete/:id` - Delete a message
- `PUT /update/:id` - Update a message

##### 🏷️ Categories (`/category`)

- `GET /:p?` - Get all categories
- `POST /add-category` - Create a new category
- `GET /:id` - Retrieve a category by ID
- `PUT /update-category/:id` - Update category details
- `GET /:id/products` - Get products within a category
- `POST /:id/add-product` - Add a product to a category
- `DELETE /delete-category/:id` - Delete a category

---