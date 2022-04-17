# RL Web Orchestration

Orchestration layer for managing connection between arena and web client

## Getting started

### Starting the application

Start the application using Node:

```bash
# Install dependencies for server
npm install

# Run the server
node server
```

Start the application using Docker:

```bash
# Building the image
docker build --tag webrtcvideobroadcast .

# Run the image in a container
docker run -d -p 4000:4000 webrtcvideobroadcast
```

## Shoutout

Thanks to Tanner Gabriels for the best article on WebRTC in Node! [Building a WebRTC video broadcast using Javascript](https://gabrieltanner.org/blog/webrtc-video-broadcast)
