const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("server working");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0o3jxdg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db("b2b_wholesale").command({ ping: 1 });

    const db = client.db("b2b_wholesale");
    const productCollection = db.collection("products");
    const categoryCollection = db.collection("categories");
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

    app.get("/my-products", async (req, res) => {
      const email = req.query.email;

      const query = { user_email: email };
      const result = await productCollection.find(query).toArray();
      res.send(result);
    });

    // Add Product
    app.post("/add-product", async (req, res) => {
      const doc = req.body;

      const result = await productCollection.insertOne(doc);
      res.send(result);
    });

    // Update Product
    app.put("/update-product/:id", async (req, res) => {
      const document = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: document,
      };
      const result = await productCollection.updateOne(query, update);
      res.send(result);
    });

    // Delete Product

    app.delete("/delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(query);

      res.send(result);
    });

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
