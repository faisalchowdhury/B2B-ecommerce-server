require("dotenv").config();
const Stripe = require("stripe");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 3000;
const app = express();
app.use(
  cors({
    origin: ["http://localhost:5173", "https://b2b-wholesale-4c968.web.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.get("/", (req, res) => {
  res.send("server working");
});
const stripe = Stripe(process.env.STRIPE_SECRET);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0o3jxdg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Middleware
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.jwt_token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
    } else {
      req.decoded = decoded;
      next();
    }
  });
};

const emailVerifying = (req, res, next) => {
  const email = req.headers["user-email"];
  if (email != req.decoded.email) {
    return res.status(403).send({ message: "Forbidden Access" });
  }
  next();
};
// Middleware

async function run() {
  try {
    // await client.connect();
    // await client.db("b2b_wholesale").command({ ping: 1 });

    const db = client.db("b2b_wholesale");
    const productCollection = db.collection("products");
    const categoryCollection = db.collection("categories");
    const cartCollection = db.collection("cart");
    const orderCollection = db.collection("order");
    const userCollection = db.collection("users");

    // user

    app.post("/user", async (req, res) => {
      const email = req.body.email;
      const findEmail = await userCollection.findOne({ email });
      if (findEmail) {
        return res.send({ message: "User already exist" });
      }
      const doc = req.body;
      const result = await userCollection.insertOne(doc);

      res.status(201).send({ message: "Data created" });
    });

    //  Jwt Token

    app.post("/jwt", (req, res) => {
      const email = req.body.email;
      const token = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      res.cookie("jwt_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
      });

      res.send({ success: true });
    });

    //  Remove Jwt token from cookie

    app.post("/logout", (req, res) => {
      res.cookie("jwt_token", "", {
        httpOnly: true,
        secure: true,
        sameSite: "None",
      });

      res.send({ message: "logout" });
    });

    // Get category Limit 5
    app.get("/categories-limit", async (req, res) => {
      const result = await categoryCollection.find().limit(5).toArray();
      res.send(result);
    });
    //  Get categories
    app.get("/categories", async (req, res) => {
      const result = await categoryCollection.find().toArray();
      res.send(result);
    });

    // Get Products by category

    app.get("/category/:category", async (req, res) => {
      const category = req.params.category;

      const query = { category };

      const result = await productCollection.find(query).toArray();
      res.send(result);
    });

    // single product

    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(query);
      res.send(result);
    });

    // New Arrival Products
    app.get("/new-arrival-products", async (req, res) => {
      const result = await productCollection
        .find()
        .sort({ _id: -1 })
        .limit(4)
        .toArray();
      res.send(result);
    });

    // All Products
    app.get("/products", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });
    // My Products

    app.get("/my-products", verifyToken, emailVerifying, async (req, res) => {
      const email = req.query.email;

      const query = { user_email: email };
      const result = await productCollection.find(query).toArray();
      res.send(result);
    });

    // Add Product
    app.post("/add-product", verifyToken, emailVerifying, async (req, res) => {
      const doc = req.body;
      doc.price = parseFloat(doc.price);
      doc.quantity = parseInt(doc.quantity);
      doc.minimum_selling_quantity = parseInt(doc.minimum_selling_quantity);
      doc.rating = parseInt(doc.rating);
      const result = await productCollection.insertOne(doc);
      res.send(result);
    });

    // Update Product
    app.put(
      "/update-product/:id",
      verifyToken,
      emailVerifying,
      async (req, res) => {
        const document = req.body;
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: document,
        };
        const result = await productCollection.updateOne(query, update);
        res.send(result);
      }
    );

    // Delete Product

    app.delete("/delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(query);

      // Delete this product from cart
      const cartQuery = { product_id: id };
      const deleteCart = await cartCollection.deleteMany(cartQuery);

      res.send(result);
    });

    //////////////////////Cart Endpoints//////////////////////

    // Add To cart

    app.post("/add-to-cart", async (req, res) => {
      const doc = req.body;

      const result = await cartCollection.insertOne({
        ...doc,
        date: new Date(),
      });

      // Fixing Quantity
      const quantity = parseInt(doc.quantity);
      const filter = { _id: new ObjectId(doc.product_id) };

      const fixQuantity = {
        $inc: { quantity: -quantity },
      };

      await productCollection.updateOne(filter, fixQuantity);
      res.send(result);
    });
    // Cart Products

    app.get("/cart", verifyToken, emailVerifying, async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const result = await cartCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();

      for (let cartProduct of result) {
        const allProducts = await productCollection.findOne({
          _id: new ObjectId(cartProduct.product_id),
        });

        if (allProducts) {
          cartProduct.product_name = allProducts.product_name;
          cartProduct.price = allProducts.price;
          cartProduct.category = allProducts.category;
          cartProduct.image_url = allProducts.image_url;
          cartProduct.description = allProducts.description;
          cartProduct.short_description = allProducts.short_description;
        }
      }
      res.send(result);
    });

    // Get cart by Cart id

    app.get("/cart/:cartId", async (req, res) => {
      const cartId = req.params.cartId;

      const cart = await cartCollection.findOne({ _id: new ObjectId(cartId) });

      const product = await productCollection.findOne({
        _id: new ObjectId(cart.product_id),
      });

      cart.product_name = product.product_name;
      cart.image_url = product.image_url;
      cart.price = product.price;

      res.status(200).send(cart);
    });
    //Delete Cart

    app.delete("/delete-cart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const fullCart = await cartCollection.findOne(query);

      const filter = { _id: new ObjectId(fullCart.product_id) };
      const fixQuantity = {
        $inc: { quantity: fullCart.quantity },
      };
      await productCollection.updateOne(filter, fixQuantity);

      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Checkout payment

    app.post("/create-payment-intent", async (req, res) => {
      const { amount } = req.body;
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
      }
    });

    // Place order
    app.post("/add-order", async (req, res) => {
      const orderInfo = req.body;

      const result = await orderCollection.insertOne(orderInfo);
      res.status(201).send(result);
    });

    // Remove from cart

    app.delete("/remove-from-cart/:cartId", async (req, res) => {
      const cartId = req.params.cartId;
      const query = { _id: new ObjectId(cartId) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // My orders

    app.get("/my-orders", async (req, res) => {
      const email = req.query.email;
      const query = { user_email: email };

      try {
        const result = await orderCollection
          .find(query)
          .sort({ _id: -1 })
          .toArray();

        for (let order of result) {
          const product = await productCollection.findOne({
            _id: new ObjectId(order.product_id),
          });

          if (product) {
            order.product_name = product.product_name;
            order.price = product.price;
            order.category = product.category;
            order.image_url = product.image_url;
            order.description = product.description;
            order.short_description = product.short_description;
          }
        }

        res.send(result);
      } catch (error) {
        console.error("Error fetching user orders:", error);
        res.status(500).json({ message: "Server error fetching user orders" });
      }
    });

    //  //////////////////////////
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log("server running on ", port);
});

//  // Fixing Quantity
// const fixQuantity = {
//   $inc: { quantity: num_quantity },
// };
// const filter = { _id: new ObjectId(product_id) };
// await productCollection.updateOne(filter, fixQuantity);
