export function renderPlannedModule(route) {
  return `
    <section class="status-view" aria-labelledby="module-heading">
      <p class="eyebrow">Workspace / ${route.title}</p>
      <h2 id="module-heading">${route.title} is on the roadmap.</h2>
      <p class="status-view__description">${route.description}</p>
      <span class="status-view__meta">Planned: ${route.phase}</span>
      <p class="status-view__action"><a class="button button--primary" href="#/dashboard">Back to dashboard</a></p>
    </section>
  `;
}

export function renderSettings() {
  return `
    <section class="status-view" aria-labelledby="settings-heading">
      <p class="eyebrow">Preferences / This browser</p>
      <h2 id="settings-heading">A workspace that feels right.</h2>
      <p class="status-view__description">Choose a theme and motion preference. Light is the default; your choices are saved in this browser and take effect immediately.</p>
      <div class="settings-grid">
        <section class="settings-item" aria-labelledby="settings-motion-title">
          <h3 id="settings-motion-title">Motion</h3>
          <p>Turn interface transitions and entrance animations on or off.</p>
          <label class="preference-toggle" for="animations-enabled">
            <input id="animations-enabled" type="checkbox" checked>
            <span>Enable animations</span>
          </label>
        </section>
        <section class="settings-item" aria-labelledby="settings-storage-title">
          <h3 id="settings-storage-title">Local storage</h3>
          <p>PEN501 keeps learning data in this browser. It does not sync to another device.</p>
          <p class="storage-status" id="storage-status" role="status" aria-live="polite">Checking IndexedDB…</p>
          <p class="storage-detail" id="storage-detail"></p>
          <p class="storage-detail" id="storage-retention"></p>
        </section>
        <section class="settings-item" aria-labelledby="settings-about-title">
          <h3 id="settings-about-title">About PEN501</h3>
          <p>A static-first personal English learning workspace. Theme preference uses LocalStorage; learning records use IndexedDB.</p>
        </section>
        <section class="settings-item settings-item--wide" aria-labelledby="settings-backup-title">
          <h3 id="settings-backup-title">Backup and restore</h3>
          <p>Export a JSON copy of this browser's PEN501 data. Restore replaces the current PEN501 records on this device. Backup files may be large when they include documents.</p>
          <div class="backup-actions">
            <button class="button button--primary" id="backup-export" type="button">Export backup</button>
            <label class="file-control" for="backup-file">Choose a PEN501 backup (.json)</label>
            <input class="backup-file" id="backup-file" type="file" accept=".json,application/json">
            <button class="button button--secondary" id="backup-restore" type="button" disabled>Restore selected backup</button>
          </div>
          <p class="backup-status" id="backup-status" role="status" aria-live="polite">Select a backup file before restoring. Restore will replace current PEN501 records.</p>
        </section>
      </div>
    </section>
  `;
}
