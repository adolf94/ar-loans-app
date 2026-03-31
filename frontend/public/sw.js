self.addEventListener('install', () => {
  console.log('Old SW Self-Destruct installing...');
  self.skipWaiting();
});

self.addEventListener('activate', async () => {
  console.log('Old SW Self-Destruct activating...');
  const registrations = await self.registration.unregister();
  if (registrations) {
    console.log('Old SW successfully unregistered.');
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      if (client.url && 'navigate' in client) {
        client.navigate(client.url);
      }
    });
  }
});
