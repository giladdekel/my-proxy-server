const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json()); // to parse JSON body

app.post("/api", async (req, res) => {
  try {
    const anthropicUrl = "https://api.anthropic.com/v1/complete";
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": req.header("x-api-key"),
      "anthropic-version": req.header("anthropic-version"),
    };

    // Set up headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Send a request to Anthropic API with stream: true
    const response = await axios.post(
      anthropicUrl,
      { ...req.body, stream: true },
      { headers, responseType: "stream" }
    );

    // Pipe Anthropic SSE events to your client
    response.data.on("data", (chunk) => {
      const data = chunk.toString();
      if (data.startsWith("event: ")) {
        res.write(data); // Forward the raw event data to the client
      }
    });

    // Handle Anthropic stream end
    response.data.on("end", () => {
      res.write("event: end\ndata: Anthropic stream ended\n\n");
      res.end();
    });

    response.data.on("error", (err) => {
      console.error("Error in Anthropic Stream:", err);
      res.write(`event: error\ndata: ${err.message}\n\n`);
      res.end();
    });

    if (response.status >= 300) {
      // handle error
      console.error(
        "Error status received from Anthropic API:",
        response.status
      );
      res.status(500).send("Error status received from Anthropic API");
      return;
    }

    // Handle errors
    req.on("close", () => {
      //   response.data.destroy(); // Destroy the stream on client disconnect
      response.request.abort(); // Close the request to Anthropic API on client disconnect
    });
  } catch (error) {
    console.error("Error while connecting to Anthropic:", error.message);
    res.status(500).send("Error while connecting to Anthropic");
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
