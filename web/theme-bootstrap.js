// Quartinaut: Theme vor erstem Paint anwenden; externe Datei für CSP.
(() => {
      try {
        const choice = localStorage.getItem('quartinaut-theme') || 'system';
        if (choice === 'white') document.documentElement.dataset.theme = 'light';
        else if (choice === 'amoled') document.documentElement.dataset.theme = 'dark';
        else if (['light','dark','green','red'].includes(choice)) document.documentElement.dataset.theme = choice;
        document.documentElement.dataset.themeChoice = choice;
      } catch {}
    })();
