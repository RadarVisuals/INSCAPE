if (import.meta.env.DEV && import.meta.env.MODE === 'design-lab') {
  import('./main.jsx').then(({ mount }) => mount(document.getElementById('root'))).catch(error => {
    document.getElementById('root').textContent = `The design lab could not start: ${error.message}. Reload to retry.`;
  });
} else {
  document.getElementById('root').textContent = 'Start the local design lab with npm run design:lab, then open http://127.0.0.1:5179/design-lab.html';
}
