"use strict";(()=>{var d=class n extends Error{status;code;issues;raw;constructor(e,t=500,r="API_ERROR",a,i){super(e),this.name="Analitica360Error",this.status=t,this.code=r,this.issues=a,this.raw=i,Object.setPrototypeOf(this,n.prototype)}static fromResponse(e,t,r="Error en la solicitud"){let a=r,i=`HTTP_${e}`,o;if(t&&typeof t=="object"){let s=t;if(Array.isArray(s.issues)&&s.issues.length>0){o=s.issues;let l=o[0]?.message;l&&(a=l),i="VALIDATION_ERROR"}else typeof s.message=="string"?a=s.message:Array.isArray(s.message)&&typeof s.message[0]=="string"&&(a=s.message[0]);typeof s.error=="string"&&(i=s.error.toUpperCase().replace(/\s+/g,"_"))}return e===429?(i="RATE_LIMITED",a="Demasiadas solicitudes. Por favor, intent\xE1 de nuevo en unos momentos."):e===404?i="NOT_FOUND":e===409&&(i="CONFLICT"),new n(a,e,i,o,t)}};function f(){if(typeof window<"u"){let e=window.__ANALITICA_API_URL__;return e?e.replace(/\/+$/,""):"https://api.analitica360.app"}let n=globalThis.process;return n?.env?.ANALITICA_API_URL?n.env.ANALITICA_API_URL.replace(/\/+$/,""):"http://localhost:3001"}var c=class{empresaId;baseUrl;tiendaKey;clientIp;customFetch;constructor(e){if(!e.empresaId)throw new Error('Analitica360Client: se requiere "empresaId" para inicializar el cliente.');this.empresaId=e.empresaId,this.baseUrl=(e.baseUrl||f()).replace(/\/+$/,""),this.tiendaKey=e.tiendaKey,this.clientIp=e.clientIp,this.customFetch=e.fetch||fetch.bind(globalThis)}async request(e,t={}){let r=`${this.baseUrl}/tienda/${this.empresaId}${e.startsWith("/")?e:`/${e}`}`,a=new Headers(t.headers||{});a.has("Accept")||a.set("Accept","application/json"),t.body&&!a.has("Content-Type")&&a.set("Content-Type","application/json"),this.tiendaKey&&(a.set("x-tienda-key",this.tiendaKey),this.clientIp&&a.set("x-forwarded-for",this.clientIp));let i;try{i=await this.customFetch(r,{...t,headers:a})}catch(l){throw new d(`Error de conexi\xF3n al conectar con Anal\xEDtica 360 (${l.message})`,0,"NETWORK_ERROR",void 0,l)}let o=null;if((i.headers.get("content-type")||"").includes("application/json"))try{o=await i.json()}catch{}else try{o=await i.text()}catch{}if(!i.ok)throw d.fromResponse(i.status,o);return o}turnos={opciones:()=>this.request("/turnos"),libres:e=>{let t=new URLSearchParams({fecha:e.fecha,servicioId:e.servicioId});return e.recursoId&&t.set("recursoId",e.recursoId),this.request(`/turnos/libres?${t.toString()}`)},reservar:(e,t)=>{let r={};return t&&(r["x-sesion-tienda"]=t),this.request("/turnos",{method:"POST",headers:r,body:JSON.stringify(e)})},verCancelacion:e=>this.request(`/turnos/cancelar/${encodeURIComponent(e)}`),cancelar:e=>this.request(`/turnos/cancelar/${encodeURIComponent(e)}`,{method:"POST"})};catalogo={listar:()=>this.request("/catalogo"),condiciones:()=>this.request("/condiciones")};cupones={validar:(e,t)=>this.request("/cupones/validar",{method:"POST",body:JSON.stringify({codigo:e,subtotal:t})})};envios={cotizar:e=>this.request("/envios/cotizar",{method:"POST",body:JSON.stringify(e)})};pedidos={crear:(e,t)=>{let r={};return t&&(r["x-sesion-tienda"]=t),this.request("/pedidos",{method:"POST",headers:r,body:JSON.stringify(e)})},pagar:e=>this.request(`/pedidos/${e}/pago`,{method:"POST"})}};var h=`
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600;1,700&display=swap');

:root {
  --a360-font-serif: "Cormorant Garamond", Garamond, Georgia, "Times New Roman", serif;
  --a360-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --a360-primary: #059669;
  --a360-primary-hover: #047857;
  --a360-primary-light: #ecfdf5;
  --a360-text: #1f2937;
  --a360-text-muted: #6b7280;
  --a360-bg: #ffffff;
  --a360-border: #e5e7eb;
  --a360-radius: 14px;
  --a360-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.a360-launcher-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999990;
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: var(--a360-primary);
  color: #ffffff;
  border: none;
  border-radius: 9999px;
  padding: 13px 24px;
  font-family: var(--a360-font-serif);
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  box-shadow: 0 10px 20px -3px rgba(5, 150, 105, 0.4);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.a360-launcher-btn:hover {
  transform: translateY(-2px);
  background-color: var(--a360-primary-hover);
  box-shadow: 0 14px 24px -3px rgba(5, 150, 105, 0.5);
}

.a360-launcher-btn.bottom-left {
  right: auto;
  left: 24px;
}

.a360-launcher-btn svg {
  width: 20px;
  height: 20px;
}

/* Modal Overlay */
.a360-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(17, 24, 39, 0.6);
  backdrop-filter: blur(4px);
  z-index: 999995;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s ease, visibility 0.25s ease;
}

.a360-overlay.a360-open {
  opacity: 1;
  visibility: visible;
}

/* Modal Container */
.a360-modal {
  background: var(--a360-bg);
  color: var(--a360-text);
  border-radius: var(--a360-radius);
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--a360-shadow);
  display: flex;
  flex-direction: column;
  position: relative;
  font-family: var(--a360-font-sans);
  transform: scale(0.95);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.a360-overlay.a360-open .a360-modal {
  transform: scale(1);
}

/* Header */
.a360-header {
  padding: 18px 24px;
  border-bottom: 1px solid var(--a360-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.a360-header-title {
  margin: 0;
  font-family: var(--a360-font-serif);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--a360-text);
  display: flex;
  align-items: center;
  gap: 10px;
}

.a360-header-close {
  background: none;
  border: none;
  color: var(--a360-text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
}

.a360-header-close:hover {
  background-color: var(--a360-border);
  color: var(--a360-text);
}

/* Steps progress bar */
.a360-steps {
  display: flex;
  padding: 12px 24px;
  background-color: #f9fafb;
  border-bottom: 1px solid var(--a360-border);
  gap: 8px;
}

.a360-step-indicator {
  flex: 1;
  height: 4px;
  background-color: var(--a360-border);
  border-radius: 2px;
  transition: background-color 0.2s ease;
}

.a360-step-indicator.active {
  background-color: var(--a360-primary);
}

/* Content */
.a360-body {
  padding: 24px;
  flex: 1;
}

.a360-step-title {
  margin: 0 0 16px 0;
  font-family: var(--a360-font-serif);
  font-size: 21px;
  font-weight: 700;
  color: var(--a360-text);
}

/* Item cards (Services, Professionals) */
.a360-card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.a360-card-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1.5px solid var(--a360-border);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.1s ease;
  user-select: none;
}

.a360-card-item:hover {
  border-color: var(--a360-primary);
  background-color: var(--a360-primary-light);
  transform: translateY(-1px);
}

.a360-card-item.selected {
  border-color: var(--a360-primary);
  background-color: var(--a360-primary-light);
}

.a360-card-info h4 {
  margin: 0 0 3px 0;
  font-family: var(--a360-font-serif);
  font-size: 19px;
  font-weight: 700;
  line-height: 1.2;
}

.a360-card-info p {
  margin: 0;
  font-size: 13px;
  color: var(--a360-text-muted);
}

.a360-card-price {
  font-family: var(--a360-font-serif);
  font-size: 19px;
  font-weight: 700;
  color: var(--a360-primary);
}

/* Days picker (horizontal chips) */
.a360-days-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 12px;
  margin-bottom: 18px;
}

.a360-day-chip {
  flex: 0 0 auto;
  padding: 10px 14px;
  border: 1px solid var(--a360-border);
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.a360-day-chip:hover {
  border-color: var(--a360-primary);
}

.a360-day-chip.selected {
  background-color: var(--a360-primary);
  border-color: var(--a360-primary);
  color: #ffffff;
}

.a360-day-chip .day-name {
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 600;
  display: block;
}

.a360-day-chip .day-number {
  font-family: var(--a360-font-serif);
  font-size: 18px;
  font-weight: 700;
}

/* Time Slots Grid */
.a360-slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}

.a360-slot-btn {
  padding: 10px 8px;
  border: 1px solid var(--a360-border);
  border-radius: 8px;
  background: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--a360-text);
  cursor: pointer;
  text-align: center;
  transition: all 0.15s ease;
}

.a360-slot-btn:hover {
  border-color: var(--a360-primary);
  background-color: var(--a360-primary-light);
}

.a360-slot-btn.selected {
  background-color: var(--a360-primary);
  border-color: var(--a360-primary);
  color: #ffffff;
}

/* Forms */
.a360-form-group {
  margin-bottom: 16px;
}

.a360-form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--a360-text);
}

.a360-input, .a360-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid var(--a360-border);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  color: var(--a360-text);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.a360-input:focus, .a360-textarea:focus {
  border-color: var(--a360-primary);
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
}

/* Footer & Buttons */
.a360-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--a360-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fafafa;
}

.a360-btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.a360-btn-secondary {
  background-color: transparent;
  color: var(--a360-text-muted);
}

.a360-btn-secondary:hover {
  color: var(--a360-text);
  background-color: var(--a360-border);
}

.a360-btn-primary {
  background-color: var(--a360-primary);
  color: #ffffff;
  font-family: var(--a360-font-serif);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.a360-btn-primary:hover:not(:disabled) {
  background-color: var(--a360-primary-hover);
}

.a360-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Success Card */
.a360-success-box {
  text-align: center;
  padding: 16px 0;
}

.a360-success-box h3 {
  font-family: var(--a360-font-serif);
  font-size: 26px;
  font-weight: 700;
}

.a360-success-icon {
  width: 56px;
  height: 56px;
  background-color: #d1fae5;
  color: #059669;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px auto;
}

.a360-success-icon svg {
  width: 32px;
  height: 32px;
}

.a360-summary-card {
  background-color: #f9fafb;
  border: 1px solid var(--a360-border);
  border-radius: 10px;
  padding: 16px;
  text-align: left;
  margin: 18px 0;
  font-size: 14px;
  line-height: 1.6;
}

.a360-loading-spinner {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 3px solid rgba(5, 150, 105, 0.2);
  border-radius: 50%;
  border-top-color: var(--a360-primary);
  animation: a360-spin 0.8s linear infinite;
  margin: 20px auto;
}

@keyframes a360-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .a360-modal {
    max-height: 96vh;
    border-radius: 16px 16px 0 0;
    margin-top: auto;
  }
  .a360-overlay {
    padding: 0;
    align-items: flex-end;
  }
}
`;var p=class{options;client;container=null;overlay=null;modal=null;currentStep=1;agendaData=null;selectedServicio=null;selectedProfesional=null;selectedDate="";selectedSlot="";availableSlots=[];loadingSlots=!1;isSubmitting=!1;constructor(e){this.options={buttonText:"Reservar Turno",title:"Reserva de Turnos Online",position:"bottom-right",...e},this.client=new c({empresaId:this.options.empresaId,baseUrl:this.options.baseUrl}),this.injectStyles(),this.init()}injectStyles(){if(typeof document>"u")return;let e="a360-font-cormorant";if(!document.getElementById(e)){if(!document.querySelector('link[href*="fonts.googleapis.com"]')){let a=document.createElement("link");a.rel="preconnect",a.href="https://fonts.googleapis.com",document.head.appendChild(a)}if(!document.querySelector('link[href*="fonts.gstatic.com"]')){let a=document.createElement("link");a.rel="preconnect",a.href="https://fonts.gstatic.com",a.crossOrigin="anonymous",document.head.appendChild(a)}let r=document.createElement("link");r.id=e,r.rel="stylesheet",r.href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&display=swap",document.head.appendChild(r)}let t="a360-widget-styles";if(!document.getElementById(t)){let r=document.createElement("style");r.id=t,r.textContent=h,this.options.themeColor&&(r.textContent+=`
:root { --a360-primary: ${this.options.themeColor}; }
`),document.head.appendChild(r)}}init(){typeof document>"u"||(this.options.position!=="custom"&&this.renderLauncher(),this.renderModalStructure())}renderLauncher(){let e=document.createElement("button");e.className=`a360-launcher-btn ${this.options.position==="bottom-left"?"bottom-left":""}`,e.innerHTML=`
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span>${this.options.buttonText}</span>
    `,e.onclick=()=>this.open(),document.body.appendChild(e)}renderModalStructure(){let e=document.createElement("div");e.className="a360-overlay",e.onclick=r=>{r.target===e&&this.close()};let t=document.createElement("div");t.className="a360-modal",e.appendChild(t),document.body.appendChild(e),this.overlay=e,this.modal=t}async open(){this.overlay&&(this.overlay.classList.add("a360-open"),this.currentStep=1,this.selectedServicio=null,this.selectedProfesional=null,this.selectedSlot="",await this.loadAgendaData())}close(){this.overlay&&this.overlay.classList.remove("a360-open")}async loadAgendaData(){if(this.modal){this.modal.innerHTML=`
      <div class="a360-body" style="text-align: center; padding: 40px;">
        <div class="a360-loading-spinner"></div>
        <p style="color: var(--a360-text-muted); font-size: 14px; margin-top: 8px;">Cargando servicios...</p>
      </div>
    `;try{let e=await this.client.turnos.opciones();if(!e.activa){this.renderInactiva();return}this.agendaData=e,this.selectedDate=e.hoy,this.renderCurrentStep()}catch(e){this.renderError(e.message)}}}renderInactiva(){this.modal&&(this.modal.innerHTML=`
      <div class="a360-header">
        <h3 class="a360-header-title">Reservas no disponibles</h3>
        <button class="a360-header-close" onclick="document.querySelector('.a360-overlay').classList.remove('a360-open')">\u2715</button>
      </div>
      <div class="a360-body" style="text-align: center; padding: 30px;">
        <p style="color: var(--a360-text-muted);">En este momento el negocio no tiene habilitadas las reservas online.</p>
        <button class="a360-btn a360-btn-primary" style="margin-top: 16px;" onclick="document.querySelector('.a360-overlay').classList.remove('a360-open')">Entendido</button>
      </div>
    `)}renderError(e){this.modal&&(this.modal.innerHTML=`
      <div class="a360-header">
        <h3 class="a360-header-title">Aviso</h3>
        <button class="a360-header-close" onclick="document.querySelector('.a360-overlay').classList.remove('a360-open')">\u2715</button>
      </div>
      <div class="a360-body" style="text-align: center; padding: 30px;">
        <p style="color: #ef4444; font-weight: 500;">${e}</p>
        <button class="a360-btn a360-btn-secondary" style="margin-top: 16px;" onclick="document.querySelector('.a360-overlay').classList.remove('a360-open')">Cerrar</button>
      </div>
    `)}renderCurrentStep(){if(!this.modal||!this.agendaData)return;let e="",t=this.checkCanGoNext();switch(this.currentStep){case 1:e=this.renderStep1();break;case 2:e=this.renderStep2();break;case 3:e=this.renderStep3();break;case 4:e=this.renderStep4();break}this.modal.innerHTML=`
      <div class="a360-header">
        <h3 class="a360-header-title">
          <svg style="width: 20px; height: 20px; color: var(--a360-primary);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          ${this.options.title}
        </h3>
        <button class="a360-header-close" id="a360-close-btn">\u2715</button>
      </div>
      <div class="a360-steps">
        <div class="a360-step-indicator ${this.currentStep>=1?"active":""}"></div>
        <div class="a360-step-indicator ${this.currentStep>=2?"active":""}"></div>
        <div class="a360-step-indicator ${this.currentStep>=3?"active":""}"></div>
        <div class="a360-step-indicator ${this.currentStep>=4?"active":""}"></div>
      </div>
      <div class="a360-body">
        ${e}
      </div>
      <div class="a360-footer">
        ${this.currentStep>1?'<button class="a360-btn a360-btn-secondary" id="a360-prev-btn">Atr\xE1s</button>':"<div></div>"}
        <button class="a360-btn a360-btn-primary" id="a360-next-btn" ${t?"":"disabled"}>
          ${this.currentStep===4?this.isSubmitting?"Reservando...":"Confirmar Reserva":"Continuar"}
        </button>
      </div>
    `,this.bindEvents()}checkCanGoNext(){return this.currentStep===1?!!this.selectedServicio:this.currentStep===2?!0:this.currentStep===3?!!this.selectedSlot:this.currentStep===4?!this.isSubmitting:!1}renderStep1(){return`
      <h4 class="a360-step-title">1. Eleg\xED el servicio</h4>
      <div class="a360-card-list">
        ${(this.agendaData?.servicios||[]).map(t=>`
          <div class="a360-card-item ${this.selectedServicio?.id===t.id?"selected":""}" data-servicio-id="${t.id}">
            <div class="a360-card-info">
              <h4>${t.nombre}</h4>
              <p>\u23F1\uFE0F ${t.duracionMin} minutos</p>
            </div>
            ${t.precio?`<span class="a360-card-price">$ ${t.precio.toLocaleString("es-AR")}</span>`:""}
          </div>
        `).join("")}
      </div>
    `}renderStep2(){let e=this.agendaData?.profesionales||[];return`
      <h4 class="a360-step-title">2. Eleg\xED con qui\xE9n atenderte</h4>
      <div class="a360-card-list">
        <div class="a360-card-item ${this.selectedProfesional?"":"selected"}" data-profesional-id="any">
          <div class="a360-card-info">
            <h4>Cualquier profesional disponible</h4>
            <p>Se te asignar\xE1 el primer horario libre</p>
          </div>
        </div>
        ${e.map(t=>`
          <div class="a360-card-item ${this.selectedProfesional?.id===t.id?"selected":""}" data-profesional-id="${t.id}">
            <div class="a360-card-info">
              <h4>${t.nombre}</h4>
            </div>
          </div>
        `).join("")}
      </div>
    `}renderStep3(){return`
      <h4 class="a360-step-title">3. Seleccion\xE1 d\xEDa y horario</h4>
      <div class="a360-days-row">
        ${this.generateNextDays(this.agendaData?.diasMaximo||14).map(t=>`
          <div class="a360-day-chip ${this.selectedDate===t.fecha?"selected":""}" data-date="${t.fecha}">
            <span class="day-name">${t.nombreDia}</span>
            <span class="day-number">${t.numero}</span>
          </div>
        `).join("")}
      </div>

      <div style="margin-top: 16px;">
        <label class="a360-form-label">Horarios disponibles</label>
        ${this.loadingSlots?`
          <div style="text-align: center; padding: 20px;"><div class="a360-loading-spinner"></div></div>
        `:this.availableSlots.length>0?`
          <div class="a360-slots-grid">
            ${this.availableSlots.map(t=>`
              <button type="button" class="a360-slot-btn ${this.selectedSlot===t.hora?"selected":""}" data-slot="${t.hora}">
                ${t.hora}
              </button>
            `).join("")}
          </div>
        `:`
          <p style="font-size: 13px; color: var(--a360-text-muted); text-align: center; padding: 20px 0;">
            No hay horarios libres para esta fecha. Prob\xE1 seleccionando otro d\xEDa.
          </p>
        `}
      </div>
    `}renderStep4(){return`
      <h4 class="a360-step-title">4. Tus datos de contacto</h4>
      <div class="a360-form-group">
        <label class="a360-form-label">Nombre y Apellido *</label>
        <input type="text" id="a360-input-nombre" class="a360-input" placeholder="Ej. Ana P\xE9rez" required />
      </div>
      <div class="a360-form-group">
        <label class="a360-form-label">Tel\xE9fono / WhatsApp *</label>
        <input type="tel" id="a360-input-telefono" class="a360-input" placeholder="Ej. 261 555-1234" required />
      </div>
      <div class="a360-form-group">
        <label class="a360-form-label">Notas o comentarios (opcional)</label>
        <textarea id="a360-input-notas" class="a360-textarea" rows="2" placeholder="Alguna aclaraci\xF3n para el profesional..."></textarea>
      </div>
      <div class="a360-summary-card">
        <strong>Resumen de tu turno:</strong><br>
        \u2022 Servicio: ${this.selectedServicio?.nombre}<br>
        \u2022 Profesional: ${this.selectedProfesional?.nombre||"Cualquiera disponible"}<br>
        \u2022 Fecha y Hora: ${this.selectedDate} a las ${this.selectedSlot} hs
      </div>
    `}renderSuccess(e){this.modal&&(this.modal.innerHTML=`
      <div class="a360-header">
        <h3 class="a360-header-title">\xA1Turno Confirmado!</h3>
        <button class="a360-header-close" id="a360-close-btn">\u2715</button>
      </div>
      <div class="a360-body a360-success-box">
        <div class="a360-success-icon">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 style="margin: 0 0 8px 0; font-size: 20px;">\xA1Te esperamos!</h3>
        <p style="color: var(--a360-text-muted); font-size: 14px; margin: 0 0 16px 0;">Tu reserva qued\xF3 registrada con \xE9xito en el sistema.</p>

        <div class="a360-summary-card">
          <strong>Detalles de la cita:</strong><br>
          \u2022 <strong>Servicio:</strong> ${e.servicio}<br>
          \u2022 <strong>Con:</strong> ${e.profesional}<br>
          \u2022 <strong>Cu\xE1ndo:</strong> ${e.cuando}
          ${e.mensaje?`<br><br><em>"${e.mensaje}"</em>`:""}
        </div>

        <button class="a360-btn a360-btn-primary" id="a360-finish-btn" style="width: 100%;">Finalizar</button>
      </div>
    `,document.getElementById("a360-close-btn")?.addEventListener("click",()=>this.close()),document.getElementById("a360-finish-btn")?.addEventListener("click",()=>this.close()))}bindEvents(){this.modal&&(document.getElementById("a360-close-btn")?.addEventListener("click",()=>this.close()),this.modal.querySelectorAll("[data-servicio-id]").forEach(e=>{e.addEventListener("click",()=>{let t=e.getAttribute("data-servicio-id");this.selectedServicio=this.agendaData?.servicios.find(r=>r.id===t)||null,this.renderCurrentStep()})}),this.modal.querySelectorAll("[data-profesional-id]").forEach(e=>{e.addEventListener("click",()=>{let t=e.getAttribute("data-profesional-id");this.selectedProfesional=t==="any"?null:this.agendaData?.profesionales.find(r=>r.id===t)||null,this.renderCurrentStep()})}),this.modal.querySelectorAll("[data-date]").forEach(e=>{e.addEventListener("click",async()=>{let t=e.getAttribute("data-date");t&&t!==this.selectedDate&&(this.selectedDate=t,this.selectedSlot="",await this.fetchSlots(),this.renderCurrentStep())})}),this.modal.querySelectorAll("[data-slot]").forEach(e=>{e.addEventListener("click",()=>{this.selectedSlot=e.getAttribute("data-slot")||"",this.renderCurrentStep()})}),document.getElementById("a360-next-btn")?.addEventListener("click",async()=>{this.currentStep<4?(this.currentStep++,this.currentStep===3&&this.availableSlots.length===0&&await this.fetchSlots(),this.renderCurrentStep()):await this.submitReserva()}),document.getElementById("a360-prev-btn")?.addEventListener("click",()=>{this.currentStep>1&&(this.currentStep--,this.renderCurrentStep())}))}async fetchSlots(){if(!(!this.selectedServicio||!this.selectedDate)){this.loadingSlots=!0;try{let e=await this.client.turnos.libres({fecha:this.selectedDate,servicioId:this.selectedServicio.id,recursoId:this.selectedProfesional?.id||null});this.availableSlots=e.libres}catch{this.availableSlots=[]}finally{this.loadingSlots=!1}}}async submitReserva(){let e=document.getElementById("a360-input-nombre"),t=document.getElementById("a360-input-telefono"),r=document.getElementById("a360-input-notas"),a=e?.value.trim()||"",i=t?.value.trim()||"",o=r?.value.trim()||null;if(!a){alert("Por favor, ingres\xE1 tu nombre"),e?.focus();return}if(!i){alert("Por favor, ingres\xE1 un tel\xE9fono de contacto"),t?.focus();return}this.isSubmitting=!0,this.renderCurrentStep();try{let s=await this.client.turnos.reservar({servicioId:this.selectedServicio.id,recursoId:this.selectedProfesional?.id||null,fecha:this.selectedDate,hora:this.selectedSlot,nombre:a,telefono:i,notas:o});this.isSubmitting=!1,this.renderSuccess(s),this.options.onSuccess&&this.options.onSuccess(s)}catch(s){this.isSubmitting=!1,alert(`No se pudo confirmar la reserva: ${s.message}`),this.renderCurrentStep(),this.options.onError&&this.options.onError(s)}}generateNextDays(e){let t=[],r=["Dom","Lun","Mar","Mi\xE9","Jue","Vie","S\xE1b"],a=new Date;for(let i=0;i<Math.min(e,14);i++){let o=new Date(a);o.setDate(a.getDate()+i);let s=o.getFullYear(),l=String(o.getMonth()+1).padStart(2,"0"),m=String(o.getDate()).padStart(2,"0");t.push({fecha:`${s}-${l}-${m}`,nombreDia:i===0?"Hoy":r[o.getDay()],numero:o.getDate()})}return t}};function u(n){return new p(n)}typeof window<"u"&&(window.Analitica360={Client:c,Widget:p,Error:d,init:u},document.addEventListener("DOMContentLoaded",()=>{let n=document.querySelector("script[data-empresa]");if(n){let e=n.getAttribute("data-empresa");if(e){let t=n.getAttribute("data-api-url")||void 0,r=n.getAttribute("data-color")||void 0,a=n.getAttribute("data-position")||"bottom-right",i=n.getAttribute("data-button-text")||"Reservar Turno",o=n.getAttribute("data-title")||"Reserva de Turno Online";u({empresaId:e,baseUrl:t,themeColor:r,position:a,buttonText:i,title:o})}}}));})();
