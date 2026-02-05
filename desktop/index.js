/**
 * Air Mouse – Desktop app (single process)
 * Runs the server (pairing page + Socket.IO) and mouse control on this computer.
 * Phone connects to this app; you scan the QR code to pair.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const cors = require('cors');
const { exec } = require('child_process');
function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}
const { io } = require('socket.io-client');
const { mouse } = require('@nut-tree-fork/nut-js');

// --- Server setup (same machine) ---
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const ioServer = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const rooms = new Map();
let serverPort = null;

function shortId() {
  return uuidv4().slice(0, 6);
}

function getLanHost() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

function getServerUrl(req, port) {
  const lanHost = getLanHost();
  if (lanHost && port) return `http://${lanHost}:${port}`;
  const host = req && req.get ? req.get('host') : null;
  return host ? `http://${host}` : `http://localhost:${port}`;
}

// Create room (used internally; also exposed for API if something else calls it)
app.post('/api/room', (req, res) => {
  const roomId = shortId();
  rooms.set(roomId, { desktopId: null, phoneId: null, createdAt: Date.now() });
  const baseUrl = getServerUrl(req, serverPort);
  res.json({
    roomId,
    pairingUrl: `${baseUrl}/pair/${roomId}`,
    wsUrl: baseUrl.replace(/^http/, 'ws'),
  });
});

app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  if (!rooms.has(roomId)) return res.status(404).json({ error: 'Room not found' });
  const baseUrl = getServerUrl(req, serverPort);
  res.json({
    roomId,
    pairingUrl: `${baseUrl}/pair/${roomId}`,
    wsUrl: baseUrl.replace(/^http/, 'ws'),
  });
});

app.get('/pair/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const baseUrl = getServerUrl(req, serverPort);
  const connectUrl = `airmouse://connect?server=${encodeURIComponent(baseUrl)}&room=${encodeURIComponent(roomId)}`;
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(connectUrl, { width: 220, margin: 1 });
  } catch (_) {}
  if (!qrDataUrl) qrDataUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"/>';
  const htmlPath = path.join(__dirname, 'pair.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace('__SERVER_URL__', baseUrl).replace('__ROOM_ID__', roomId).replace('__QR_DATA_URL__', qrDataUrl);
  res.type('html').send(html);
});

// Socket.IO: phone and desktop (this process) join rooms
ioServer.on('connection', (socket) => {
  socket.on('join', ({ identity, roomId }) => {
    if (!roomId || !identity) {
      socket.emit('error', { message: 'Missing roomId or identity' });
      return;
    }
    let room = rooms.get(roomId);
    if (!room) {
      room = { desktopId: null, phoneId: null, createdAt: Date.now() };
      rooms.set(roomId, room);
    }
    socket.roomId = roomId;
    socket.identity = identity;
    socket.join(roomId);
    if (identity === 'desktop') room.desktopId = socket.id;
    else if (identity === 'phone') room.phoneId = socket.id;
    socket.emit('joined', { roomId, identity });
    if (room.desktopId && room.phoneId) ioServer.to(roomId).emit('paired', {});
  });

  socket.on('mouse:move', (data) => {
    if (socket.identity !== 'phone') return;
    socket.to(socket.roomId).emit('mouse:move', data);
  });
  socket.on('mouse:click', (data) => {
    if (socket.identity !== 'phone') return;
    socket.to(socket.roomId).emit('mouse:click', data);
  });
  socket.on('mouse:scroll', (data) => {
    if (socket.identity !== 'phone') return;
    socket.to(socket.roomId).emit('mouse:scroll', data);
  });

  socket.on('disconnect', () => {
    const room = socket.roomId && rooms.get(socket.roomId);
    if (room) {
      if (socket.identity === 'desktop') room.desktopId = null;
      if (socket.identity === 'phone') room.phoneId = null;
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.createdAt > 30 * 60 * 1000) rooms.delete(roomId);
  }
}, 5 * 60 * 1000);

// --- Random port; retry if in use ---
const net = require('net');

function getRandomPort() {
  const min = 49152;
  const max = 65535;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function findAvailablePort(callback) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : getRandomPort();
  const probe = net.createServer();
  probe.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && !process.env.PORT) {
      findAvailablePort(callback);
    } else {
      callback(e);
    }
  });
  probe.once('listening', () => {
    const p = probe.address().port;
    probe.close(() => callback(null, p));
  });
  probe.listen(port, '0.0.0.0');
}

function onListening(PORT) {
  serverPort = PORT;
  const baseUrl = getServerUrl(null, PORT);
  const roomId = shortId();
  rooms.set(roomId, { desktopId: null, phoneId: null, createdAt: Date.now() });
  const pairingUrl = `${baseUrl}/pair/${roomId}`;

  console.log('\n  Air Mouse\n');
  console.log('  Room code:', roomId);
  console.log('  Scan the QR code with your phone (browser will open).\n');
  console.log('  Server:', baseUrl);

  openBrowser(pairingUrl);

  const socket = io(`http://127.0.0.1:${PORT}`, { transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    socket.emit('join', { identity: 'desktop', roomId });
  });

  socket.on('joined', () => {
    console.log('  Waiting for phone... Scan the QR code in the browser.\n');
  });

  socket.on('paired', () => {
    console.log('  Phone connected. Use your phone as a mouse.\n');
  });

  socket.on('mouse:move', async (data) => {
    try {
      const pos = await mouse.getPosition();
      const newX = Math.round(pos.x + (data.dx || 0));
      const newY = Math.round(pos.y + (data.dy || 0));
      await mouse.setPosition({ x: newX, y: newY });
    } catch (_) {}
  });

  socket.on('mouse:click', async (data) => {
    try {
      if (data.button === 'right') await mouse.rightClick();
      else await mouse.leftClick();
    } catch (_) {}
  });

  socket.on('mouse:scroll', async (data) => {
    try {
      const amount = data.dy != null ? data.dy : data.deltaY || 0;
      const steps = Math.round(Math.abs(amount) / 40) || 1;
      if (amount > 0) {
        for (let i = 0; i < steps; i++) await mouse.scrollDown();
      } else if (amount < 0) {
        for (let i = 0; i < steps; i++) await mouse.scrollUp();
      }
    } catch (_) {}
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
  });
}

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && process.env.PORT) {
    console.error(`Port ${process.env.PORT} is in use. Set PORT to another value (e.g. PORT=3000).`);
  } else {
    console.error(e);
  }
  process.exit(1);
});

findAvailablePort((err, PORT) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  server.listen(PORT, '0.0.0.0', () => onListening(PORT));
});
