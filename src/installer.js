'use strict';

(function bootstrap() {
  const i18n = {
    fr: {
      title: 'StatNerd Relay',
      subtitle: 'Configuration locale et exécution en arrière-plan',
      port: 'Port local',
      lang: 'Langue',
      repo: 'Repository par défaut',
      root: 'Dossier racine local (Docker/Grocy)',
      startupOn: 'Lancer au démarrage: activé',
      startupOff: 'Lancer au démarrage: désactivé',
      restartRelay: 'Redémarrer le relay',
      restartApp: "Redémarrer l'application",
      save: 'Enregistrer',
      saved: 'Paramètres enregistrés.',
      relayRestarted: 'Relay redémarré.',
      appRestart: "Redémarrage de l'application...",
      error: 'Erreur',
      running: 'Relay actif',
      stopped: 'Relay arrêté',
    },
    en: {
      title: 'StatNerd Relay',
      subtitle: 'Local configuration and background service',
      port: 'Local port',
      lang: 'Language',
      repo: 'Default repository',
      root: 'Local root folder (Docker/Grocy)',
      startupOn: 'Launch at startup: enabled',
      startupOff: 'Launch at startup: disabled',
      restartRelay: 'Restart relay',
      restartApp: 'Restart application',
      save: 'Save',
      saved: 'Settings saved.',
      relayRestarted: 'Relay restarted.',
      appRestart: 'Restarting application...',
      error: 'Error',
      running: 'Relay running',
      stopped: 'Relay stopped',
    },
  };

  let current = null;

  const $ = (id) => document.getElementById(id);
  const statusNode = $('status');

  function t(key) {
    const lang = current && current.language ? current.language : 'fr';
    return (i18n[lang] && i18n[lang][key]) || (i18n.fr[key] || key);
  }

  function setStatus(text, isError) {
    statusNode.textContent = text || '';
    statusNode.style.color = isError ? '#ef4444' : '#16a34a';
  }

  function renderTexts() {
    $('title').textContent = t('title');
    $('subtitle').textContent = t('subtitle');
    $('label-port').textContent = t('port');
    $('label-lang').textContent = t('lang');
    $('label-repo').textContent = t('repo');
    $('label-root').textContent = t('root');
    $('restartRelay').textContent = t('restartRelay');
    $('restartApp').textContent = t('restartApp');
    $('save').textContent = t('save');
    $('toggleStartup').textContent = current.launchAtStartup ? t('startupOn') : t('startupOff');
  }

  function renderState(state) {
    current = state || {};
    $('port').value = Number(current.port || 17863);
    $('repository').value = current.repository || 'Raph563/Grocy';
    $('localRootPath').value = current.localRootPath || '';
    $('language').value = current.language || 'fr';
    renderTexts();
    setStatus(current.relayListening ? `${t('running')} (127.0.0.1:${current.port})` : t('stopped'), false);
  }

  async function save() {
    try {
      const payload = {
        port: Number($('port').value || 17863),
        repository: $('repository').value || 'Raph563/Grocy',
        localRootPath: $('localRootPath').value || '',
        language: $('language').value || 'fr',
        launchAtStartup: !!current.launchAtStartup,
      };
      const next = await window.relayDesktop.saveSettings(payload);
      renderState(next);
      setStatus(t('saved'), false);
    } catch (err) {
      setStatus(`${t('error')}: ${(err && err.message) ? err.message : String(err)}`, true);
    }
  }

  async function toggleStartup() {
    try {
      const next = await window.relayDesktop.saveSettings({
        launchAtStartup: !current.launchAtStartup,
      });
      renderState(next);
      setStatus(next.launchAtStartup ? t('startupOn') : t('startupOff'), false);
    } catch (err) {
      setStatus(`${t('error')}: ${(err && err.message) ? err.message : String(err)}`, true);
    }
  }

  async function init() {
    const state = await window.relayDesktop.getState();
    renderState(state);
    $('save').addEventListener('click', save);
    $('toggleStartup').addEventListener('click', toggleStartup);
    $('language').addEventListener('change', async () => {
      const next = await window.relayDesktop.saveSettings({ language: $('language').value || 'fr' });
      renderState(next);
    });
    $('restartRelay').addEventListener('click', async () => {
      await window.relayDesktop.restartRelay();
      const stateAfter = await window.relayDesktop.getState();
      renderState(stateAfter);
      setStatus(t('relayRestarted'), false);
    });
    $('restartApp').addEventListener('click', async () => {
      setStatus(t('appRestart'), false);
      await window.relayDesktop.restartApp();
    });
    window.relayDesktop.onStateChanged((next) => renderState(next));
  }

  init().catch((err) => setStatus(`${t('error')}: ${(err && err.message) ? err.message : String(err)}`, true));
})();

