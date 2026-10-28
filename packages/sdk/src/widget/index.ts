import { Analitica360Client } from '../client.js';
import type {
  AgendaOpcionesActiva,
  AgendaOpcionesResponse,
  HorarioLibre,
  TurnoProfesional,
  TurnoReservadoResult,
  TurnoServicio,
} from '../types.js';
import { WIDGET_STYLES } from './styles.js';

export interface TurnosWidgetOptions {
  empresaId: string;
  baseUrl?: string;
  themeColor?: string;
  position?: 'bottom-right' | 'bottom-left' | 'custom';
  buttonText?: string;
  title?: string;
  targetElement?: HTMLElement | string;
  onSuccess?: (reserva: TurnoReservadoResult) => void;
  onError?: (err: Error) => void;
}

export class Analitica360Widget {
  private readonly options: TurnosWidgetOptions;
  private readonly client: Analitica360Client;
  private container: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private modal: HTMLElement | null = null;

  // State
  private currentStep = 1;
  private agendaData: AgendaOpcionesActiva | null = null;
  private selectedServicio: TurnoServicio | null = null;
  private selectedProfesional: TurnoProfesional | null = null;
  private selectedDate: string = '';
  private selectedSlot: string = '';
  private availableSlots: HorarioLibre[] = [];
  private loadingSlots = false;
  private isSubmitting = false;

  constructor(options: TurnosWidgetOptions) {
    this.options = {
      buttonText: 'Reservar Turno',
      title: 'Reserva de Turnos Online',
      position: 'bottom-right',
      ...options,
    };
    this.client = new Analitica360Client({
      empresaId: this.options.empresaId,
      baseUrl: this.options.baseUrl,
    });

    this.injectStyles();
    this.init();
  }

  private injectStyles() {
    if (typeof document === 'undefined') return;

    // Inyectar Google Font Cormorant Garamond si no está presente
    const fontLinkId = 'a360-font-cormorant';
    if (!document.getElementById(fontLinkId)) {
      if (!document.querySelector('link[href*="fonts.googleapis.com"]')) {
        const preconnect1 = document.createElement('link');
        preconnect1.rel = 'preconnect';
        preconnect1.href = 'https://fonts.googleapis.com';
        document.head.appendChild(preconnect1);
      }

      if (!document.querySelector('link[href*="fonts.gstatic.com"]')) {
        const preconnect2 = document.createElement('link');
        preconnect2.rel = 'preconnect';
        preconnect2.href = 'https://fonts.gstatic.com';
        preconnect2.crossOrigin = 'anonymous';
        document.head.appendChild(preconnect2);
      }

      const fontLink = document.createElement('link');
      fontLink.id = fontLinkId;
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&display=swap';
      document.head.appendChild(fontLink);
    }

    const styleId = 'a360-widget-styles';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = WIDGET_STYLES;
      if (this.options.themeColor) {
        styleEl.textContent += `\n:root { --a360-primary: ${this.options.themeColor}; }\n`;
      }
      document.head.appendChild(styleEl);
    }
  }

  private init() {
    if (typeof document === 'undefined') return;

    if (this.options.position !== 'custom') {
      this.renderLauncher();
    }
    this.renderModalStructure();
  }

  private renderLauncher() {
    const launcher = document.createElement('button');
    launcher.className = `a360-launcher-btn ${this.options.position === 'bottom-left' ? 'bottom-left' : ''}`;
    launcher.innerHTML = `
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span>${this.options.buttonText}</span>
    `;
    launcher.onclick = () => this.open();
    document.body.appendChild(launcher);
  }

  private renderModalStructure() {
    const overlay = document.createElement('div');
    overlay.className = 'a360-overlay';
    overlay.onclick = (e) => {
      if (e.target === overlay) this.close();
    };

    const modal = document.createElement('div');
    modal.className = 'a360-modal';
    overlay.appendChild(modal);

    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.modal = modal;
  }

  public async open() {
    if (!this.overlay) return;
    this.overlay.classList.add('a360-open');
    this.currentStep = 1;
    this.selectedServicio = null;
    this.selectedProfesional = null;
    this.selectedSlot = '';
    await this.loadAgendaData();
  }

  public close() {
    if (!this.overlay) return;
    this.overlay.classList.remove('a360-open');
  }

  private async loadAgendaData() {
    if (!this.modal) return;
    this.modal.innerHTML = `
      <div class="a360-body" style="text-align: center; padding: 40px;">
        <div class="a360-loading-spinner"></div>
        <p style="color: var(--a360-text-muted); font-size: 14px; margin-top: 8px;">Cargando servicios...</p>
      </div>
    `;

    try {
      const resp: AgendaOpcionesResponse = await this.client.turnos.opciones();
      if (!resp.activa) {
        this.renderInactiva();
        return;
      }
      this.agendaData = resp;
      this.selectedDate = resp.hoy;
      this.renderCurrentStep();
    } catch (err) {
      this.renderError((err as Error).message);
    }
  }

  private renderInactiva() {
    if (!this.modal) return;
    this.modal.innerHTML = `
      <div class="a360-header">
        <h3 class="a360-header-title">Reservas no disponibles</h3>
        <button class="a360-header-close" onclick="document.querySelector('.a360-overlay').classList.remove('a360-open')">✕</button>
      </div>
      <div class="a360-body" style="text-align: center; padding: 30px;">
        <p style="color: var(--a360-text-muted);">En este momento el negocio no tiene habilitadas las reservas online.</p>
        <button class="a360-btn a360-btn-primary" style="margin-top: 16px;" onclick="document.querySelector('.a360-overlay').classList.remove('a360-open')">Entendido</button>
      </div>
    `;
  }

  private renderError(msg: string) {
    if (!this.modal) return;
    this.modal.innerHTML = `
      <div class="a360-header">
        <h3 class="a360-header-title">Aviso</h3>
        <button class="a360-header-close" onclick="document.querySelector('.a360-overlay').classList.remove('a360-open')">✕</button>
      </div>
      <div class="a360-body" style="text-align: center; padding: 30px;">
        <p style="color: #ef4444; font-weight: 500;">${msg}</p>
        <button class="a360-btn a360-btn-secondary" style="margin-top: 16px;" onclick="document.querySelector('.a360-overlay').classList.remove('a360-open')">Cerrar</button>
      </div>
    `;
  }

  private renderCurrentStep() {
    if (!this.modal || !this.agendaData) return;

    let contentHtml = '';
    const canGoNext = this.checkCanGoNext();

    switch (this.currentStep) {
      case 1:
        contentHtml = this.renderStep1();
        break;
      case 2:
        contentHtml = this.renderStep2();
        break;
      case 3:
        contentHtml = this.renderStep3();
        break;
      case 4:
        contentHtml = this.renderStep4();
        break;
    }

    this.modal.innerHTML = `
      <div class="a360-header">
        <h3 class="a360-header-title">
          <svg style="width: 20px; height: 20px; color: var(--a360-primary);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          ${this.options.title}
        </h3>
        <button class="a360-header-close" id="a360-close-btn">✕</button>
      </div>
      <div class="a360-steps">
        <div class="a360-step-indicator ${this.currentStep >= 1 ? 'active' : ''}"></div>
        <div class="a360-step-indicator ${this.currentStep >= 2 ? 'active' : ''}"></div>
        <div class="a360-step-indicator ${this.currentStep >= 3 ? 'active' : ''}"></div>
        <div class="a360-step-indicator ${this.currentStep >= 4 ? 'active' : ''}"></div>
      </div>
      <div class="a360-body">
        ${contentHtml}
      </div>
      <div class="a360-footer">
        ${this.currentStep > 1 ? '<button class="a360-btn a360-btn-secondary" id="a360-prev-btn">Atrás</button>' : '<div></div>'}
        <button class="a360-btn a360-btn-primary" id="a360-next-btn" ${canGoNext ? '' : 'disabled'}>
          ${this.currentStep === 4 ? (this.isSubmitting ? 'Reservando...' : 'Confirmar Reserva') : 'Continuar'}
        </button>
      </div>
    `;

    this.bindEvents();
  }

  private checkCanGoNext(): boolean {
    if (this.currentStep === 1) return Boolean(this.selectedServicio);
    if (this.currentStep === 2) return true; // El profesional es opcional ("Cualquiera")
    if (this.currentStep === 3) return Boolean(this.selectedSlot);
    if (this.currentStep === 4) return !this.isSubmitting;
    return false;
  }

  private renderStep1(): string {
    const servicios = this.agendaData?.servicios || [];
    return `
      <h4 class="a360-step-title">1. Elegí el servicio</h4>
      <div class="a360-card-list">
        ${servicios.map((s) => `
          <div class="a360-card-item ${this.selectedServicio?.id === s.id ? 'selected' : ''}" data-servicio-id="${s.id}">
            <div class="a360-card-info">
              <h4>${s.nombre}</h4>
              <p>⏱️ ${s.duracionMin} minutos</p>
            </div>
            ${s.precio ? `<span class="a360-card-price">$ ${s.precio.toLocaleString('es-AR')}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderStep2(): string {
    const profesionales = this.agendaData?.profesionales || [];
    return `
      <h4 class="a360-step-title">2. Elegí con quién atenderte</h4>
      <div class="a360-card-list">
        <div class="a360-card-item ${!this.selectedProfesional ? 'selected' : ''}" data-profesional-id="any">
          <div class="a360-card-info">
            <h4>Cualquier profesional disponible</h4>
            <p>Se te asignará el primer horario libre</p>
          </div>
        </div>
        ${profesionales.map((p) => `
          <div class="a360-card-item ${this.selectedProfesional?.id === p.id ? 'selected' : ''}" data-profesional-id="${p.id}">
            <div class="a360-card-info">
              <h4>${p.nombre}</h4>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderStep3(): string {
    const dias = this.generateNextDays(this.agendaData?.diasMaximo || 14);
    return `
      <h4 class="a360-step-title">3. Seleccioná día y horario</h4>
      <div class="a360-days-row">
        ${dias.map((d) => `
          <div class="a360-day-chip ${this.selectedDate === d.fecha ? 'selected' : ''}" data-date="${d.fecha}">
            <span class="day-name">${d.nombreDia}</span>
            <span class="day-number">${d.numero}</span>
          </div>
        `).join('')}
      </div>

      <div style="margin-top: 16px;">
        <label class="a360-form-label">Horarios disponibles</label>
        ${this.loadingSlots ? `
          <div style="text-align: center; padding: 20px;"><div class="a360-loading-spinner"></div></div>
        ` : this.availableSlots.length > 0 ? `
          <div class="a360-slots-grid">
            ${this.availableSlots.map((s) => `
              <button type="button" class="a360-slot-btn ${this.selectedSlot === s.hora ? 'selected' : ''}" data-slot="${s.hora}">
                ${s.hora}
              </button>
            `).join('')}
          </div>
        ` : `
          <p style="font-size: 13px; color: var(--a360-text-muted); text-align: center; padding: 20px 0;">
            No hay horarios libres para esta fecha. Probá seleccionando otro día.
          </p>
        `}
      </div>
    `;
  }

  private renderStep4(): string {
    return `
      <h4 class="a360-step-title">4. Tus datos de contacto</h4>
      <div class="a360-form-group">
        <label class="a360-form-label">Nombre y Apellido *</label>
        <input type="text" id="a360-input-nombre" class="a360-input" placeholder="Ej. Ana Pérez" required />
      </div>
      <div class="a360-form-group">
        <label class="a360-form-label">Teléfono / WhatsApp *</label>
        <input type="tel" id="a360-input-telefono" class="a360-input" placeholder="Ej. 261 555-1234" required />
      </div>
      <div class="a360-form-group">
        <label class="a360-form-label">Notas o comentarios (opcional)</label>
        <textarea id="a360-input-notas" class="a360-textarea" rows="2" placeholder="Alguna aclaración para el profesional..."></textarea>
      </div>
      <div class="a360-summary-card">
        <strong>Resumen de tu turno:</strong><br>
        • Servicio: ${this.selectedServicio?.nombre}<br>
        • Profesional: ${this.selectedProfesional?.nombre || 'Cualquiera disponible'}<br>
        • Fecha y Hora: ${this.selectedDate} a las ${this.selectedSlot} hs
      </div>
    `;
  }

  private renderSuccess(reserva: TurnoReservadoResult) {
    if (!this.modal) return;
    this.modal.innerHTML = `
      <div class="a360-header">
        <h3 class="a360-header-title">¡Turno Confirmado!</h3>
        <button class="a360-header-close" id="a360-close-btn">✕</button>
      </div>
      <div class="a360-body a360-success-box">
        <div class="a360-success-icon">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 style="margin: 0 0 8px 0; font-size: 20px;">¡Te esperamos!</h3>
        <p style="color: var(--a360-text-muted); font-size: 14px; margin: 0 0 16px 0;">Tu reserva quedó registrada con éxito en el sistema.</p>

        <div class="a360-summary-card">
          <strong>Detalles de la cita:</strong><br>
          • <strong>Servicio:</strong> ${reserva.servicio}<br>
          • <strong>Con:</strong> ${reserva.profesional}<br>
          • <strong>Cuándo:</strong> ${reserva.cuando}
          ${reserva.mensaje ? `<br><br><em>"${reserva.mensaje}"</em>` : ''}
        </div>

        <button class="a360-btn a360-btn-primary" id="a360-finish-btn" style="width: 100%;">Finalizar</button>
      </div>
    `;

    document.getElementById('a360-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('a360-finish-btn')?.addEventListener('click', () => this.close());
  }

  private bindEvents() {
    if (!this.modal) return;

    document.getElementById('a360-close-btn')?.addEventListener('click', () => this.close());

    // Step 1: Click en servicio
    this.modal.querySelectorAll('[data-servicio-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-servicio-id');
        this.selectedServicio = this.agendaData?.servicios.find((s) => s.id === id) || null;
        this.renderCurrentStep();
      });
    });

    // Step 2: Click en profesional
    this.modal.querySelectorAll('[data-profesional-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-profesional-id');
        this.selectedProfesional = id === 'any' ? null : this.agendaData?.profesionales.find((p) => p.id === id) || null;
        this.renderCurrentStep();
      });
    });

    // Step 3: Click en día
    this.modal.querySelectorAll('[data-date]').forEach((el) => {
      el.addEventListener('click', async () => {
        const date = el.getAttribute('data-date');
        if (date && date !== this.selectedDate) {
          this.selectedDate = date;
          this.selectedSlot = '';
          await this.fetchSlots();
          this.renderCurrentStep();
        }
      });
    });

    // Step 3: Click en slot
    this.modal.querySelectorAll('[data-slot]').forEach((el) => {
      el.addEventListener('click', () => {
        this.selectedSlot = el.getAttribute('data-slot') || '';
        this.renderCurrentStep();
      });
    });

    // Botón Siguiente / Confirmar
    document.getElementById('a360-next-btn')?.addEventListener('click', async () => {
      if (this.currentStep < 4) {
        this.currentStep++;
        if (this.currentStep === 3 && this.availableSlots.length === 0) {
          await this.fetchSlots();
        }
        this.renderCurrentStep();
      } else {
        await this.submitReserva();
      }
    });

    // Botón Atrás
    document.getElementById('a360-prev-btn')?.addEventListener('click', () => {
      if (this.currentStep > 1) {
        this.currentStep--;
        this.renderCurrentStep();
      }
    });
  }

  private async fetchSlots() {
    if (!this.selectedServicio || !this.selectedDate) return;
    this.loadingSlots = true;
    try {
      const resp = await this.client.turnos.libres({
        fecha: this.selectedDate,
        servicioId: this.selectedServicio.id,
        recursoId: this.selectedProfesional?.id || null,
      });
      this.availableSlots = resp.libres;
    } catch {
      this.availableSlots = [];
    } finally {
      this.loadingSlots = false;
    }
  }

  private async submitReserva() {
    const inputNombre = document.getElementById('a360-input-nombre') as HTMLInputElement | null;
    const inputTelefono = document.getElementById('a360-input-telefono') as HTMLInputElement | null;
    const inputNotas = document.getElementById('a360-input-notas') as HTMLTextAreaElement | null;

    const nombre = inputNombre?.value.trim() || '';
    const telefono = inputTelefono?.value.trim() || '';
    const notas = inputNotas?.value.trim() || null;

    if (!nombre) {
      alert('Por favor, ingresá tu nombre');
      inputNombre?.focus();
      return;
    }
    if (!telefono) {
      alert('Por favor, ingresá un teléfono de contacto');
      inputTelefono?.focus();
      return;
    }

    this.isSubmitting = true;
    this.renderCurrentStep();

    try {
      const reserva = await this.client.turnos.reservar({
        servicioId: this.selectedServicio!.id,
        recursoId: this.selectedProfesional?.id || null,
        fecha: this.selectedDate,
        hora: this.selectedSlot,
        nombre,
        telefono,
        notas,
      });

      this.isSubmitting = false;
      this.renderSuccess(reserva);
      if (this.options.onSuccess) {
        this.options.onSuccess(reserva);
      }
    } catch (err) {
      this.isSubmitting = false;
      alert(`No se pudo confirmar la reserva: ${(err as Error).message}`);
      this.renderCurrentStep();
      if (this.options.onError) {
        this.options.onError(err as Error);
      }
    }
  }

  private generateNextDays(maxDays: number): { fecha: string; nombreDia: string; numero: number }[] {
    const list: { fecha: string; nombreDia: string; numero: number }[] = [];
    const diasNombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const hoy = new Date();

    for (let i = 0; i < Math.min(maxDays, 14); i++) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      list.push({
        fecha: `${yyyy}-${mm}-${dd}`,
        nombreDia: i === 0 ? 'Hoy' : diasNombres[d.getDay()],
        numero: d.getDate(),
      });
    }
    return list;
  }
}

export function initTurnosWidget(options: TurnosWidgetOptions): Analitica360Widget {
  return new Analitica360Widget(options);
}
