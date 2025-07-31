export class UIManager {
  private isWindowActive = false;
  private activeTimeout: NodeJS.Timeout | null = null;

  setWindowActive(active: boolean, reason = 'unknown'): void {
    const container = document.getElementById('container');
    if (!container) {
      console.error('❌ Container element not found');
      return;
    }
    
    console.log(`🔄 setWindowActive called: ${active} (reason: ${reason})`);
    
    if (this.isWindowActive === active && reason !== 'timer-reset') {
      console.log('⚠️ Same state, skipping...');
      return;
    }
    
    this.isWindowActive = active;
    
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }
    
    if (active) {
      container.classList.add('active');
      console.log('✅ Window ACTIVATED - skeleton UI shown');
      
      this.activeTimeout = setTimeout(() => {
        console.log('⏰ Auto-deactivating after 5 seconds');
        this.setWindowActive(false, 'auto-timeout');
      }, 5000);
    } else {
      container.classList.remove('active');
      console.log('❌ Window DEACTIVATED - skeleton UI hidden');
    }
  }

  resetActiveTimer(): void {
    console.log('🔄 resetActiveTimer called, isWindowActive:', this.isWindowActive);
    
    if (this.isWindowActive) {
      this.setWindowActive(true, 'timer-reset');
    } else {
      this.setWindowActive(true, 'user-interaction');
    }
  }

  showHotkeysModal(): void {
    const modal = document.getElementById('hotkeys-modal') as HTMLElement;
    modal.style.display = 'flex';
  }

  hideHotkeysModal(): void {
    const modal = document.getElementById('hotkeys-modal') as HTMLElement;
    modal.style.display = 'none';
  }

  updateBackgroundRemovalButton(enabled: boolean): void {
    const button = document.getElementById('toggle-bg') as HTMLButtonElement;
    if (!button) return;
    
    if (enabled) {
      button.style.opacity = '1';
      button.style.background = 'rgba(0, 122, 255, 0.9)';
      button.style.color = 'white';
      button.style.transform = 'scale(1.05)';
      button.title = '背景除去を無効化 (Ctrl+Shift+B)';
    } else {
      button.style.opacity = '0.6';
      button.style.background = 'rgba(255, 255, 255, 0.9)';
      button.style.color = '#666';
      button.style.transform = 'scale(1)';
      button.title = '背景除去を有効化 (Ctrl+Shift+B)';
    }
    
    console.log('🔄 Background removal button updated - enabled:', enabled);
  }
}