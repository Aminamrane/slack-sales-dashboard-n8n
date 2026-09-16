// Keep the entry independent of React, page code and CSS so the HTML loading
// screen can paint while the application downloads, even on a slow connection.
import("./App.jsx")
  .then(({ mountApp }) => mountApp())
  .catch(() => window.ownerStartup?.fail());
