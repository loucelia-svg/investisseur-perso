self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {
    title: "Investisseur Perso",
    body: "Une alerte boursière a été déclenchée.",
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
    })
  );
});