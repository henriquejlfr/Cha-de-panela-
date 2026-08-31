const config = window.APP_CONFIG;

if (!config || !config.SUPABASE_URL || !config.SUPABASE_KEY) {
  alert("Configure o arquivo js/config.js antes de publicar.");
}

const sb = window.supabase.createClient(
  config.SUPABASE_URL,
  config.SUPABASE_KEY
);

const state = {
  products: [],
  selectedProduct: null,
  activeFilter: "todos",
  reservation: null
};

const giftGrid = document.getElementById("giftGrid");
const loading = document.getElementById("loading");
const emptyState = document.getElementById("emptyState");
const filtersEl = document.getElementById("filters");
const modal = document.getElementById("giftModal");
const chooseStep = document.getElementById("chooseStep");
const resultStep = document.getElementById("resultStep");
const modalTitle = document.getElementById("modalTitle");
const modalPrice = document.getElementById("modalPrice");
const guestName = document.getElementById("guestName");
const toast = document.getElementById("toast");

const money = value =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value || 0));

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value = "") {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function placeholderImage(name) {
  const label = encodeURIComponent(name || "Presente");
  return `https://placehold.co/800x600/eee5dc/69594c?text=${label}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

async function refreshExpiredReservations() {
  try {
    await sb.rpc("refresh_expired_reservations");
  } catch (error) {
    console.warn("Não foi possível atualizar reservas expiradas.", error);
  }
}

async function loadProducts() {
  loading.classList.remove("hidden");
  emptyState.classList.add("hidden");

  await refreshExpiredReservations();

  const { data, error } = await sb
    .from("products")
    .select("*")
    .order("created_at", { ascending: true });

  loading.classList.add("hidden");

  if (error) {
    giftGrid.innerHTML = `
      <div class="empty-state">
        Não conseguimos carregar os presentes agora.<br>
        <small>${escapeHtml(error.message)}</small>
      </div>
    `;
    return;
  }

  state.products = data || [];
  buildFilters();
  renderProducts();
}

function buildFilters() {
  const categories = [...new Set(
    state.products
      .map(item => item.category?.trim())
      .filter(Boolean)
  )];

  filtersEl.innerHTML = `
    <button class="filter ${state.activeFilter === "todos" ? "active" : ""}" data-filter="todos">
      Todos
    </button>
    ${categories.map(category => `
      <button class="filter ${state.activeFilter === category ? "active" : ""}"
              data-filter="${escapeHtml(category)}">
        ${escapeHtml(category)}
      </button>
    `).join("")}
  `;

  filtersEl.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.filter;
      buildFilters();
      renderProducts();
    });
  });
}

function renderProducts() {
  const visible = state.products.filter(product =>
    state.activeFilter === "todos" || product.category === state.activeFilter
  );

  emptyState.classList.toggle("hidden", visible.length !== 0);

  giftGrid.innerHTML = visible.map(product => {
    const available = product.status === "available";
    const image = product.image_url || placeholderImage(product.name);

    return `
      <article class="gift-card ${available ? "available" : "unavailable"}">
        <div class="gift-image-wrap">
          <img class="gift-image"
               src="${escapeHtml(image)}"
               alt="${escapeHtml(product.name)}"
               onerror="this.src='${placeholderImage(product.name)}'">
          <span class="status-badge ${available ? "status-available" : "status-reserved"}">
            ${available ? "Disponível" : "Já escolhido ♡"}
          </span>
        </div>

        <div class="gift-content">
          <span class="gift-category">${escapeHtml(product.category || "Nosso lar")}</span>
          <h3>${escapeHtml(product.name)}</h3>
          <p class="gift-description">${escapeHtml(product.description || "Um mimo para o nosso futuro cantinho.")}</p>
          ${product.cash_only ? `<p class="gift-category" style="margin-top:8px;">💚 Somente contribuição em dinheiro</p>` : ""}
          <div class="gift-price">${money(product.price)}</div>

          ${
            available
              ? `<button class="button button-dark choose-gift" data-id="${product.id}">
                   Quero dar este presente
                 </button>`
              : `<button class="disabled-button" disabled>✓ Presente já escolhido</button>`
          }
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".choose-gift").forEach(button => {
    button.addEventListener("click", () => {
      const product = state.products.find(p => String(p.id) === button.dataset.id);
      openGiftModal(product);
    });
  });
}

function openGiftModal(product) {
  state.selectedProduct = product;
  state.reservation = null;

  modalTitle.textContent = product.name;
  modalPrice.textContent = money(product.price);
  guestName.value = "";

  const storeButton = document.getElementById("chooseStore");
  const pixButton = document.getElementById("choosePix");
  const creditButton = document.getElementById("chooseCredit");

  const storeAllowed = !product.cash_only && Boolean(product.store_url);
  const creditAllowed = Boolean(product.payment_url);

  storeButton.classList.toggle("hidden", !storeAllowed);
  creditButton.classList.toggle("hidden", !creditAllowed);

  // Deixa a grade visualmente equilibrada dependendo das opções disponíveis.
  pixButton.style.gridColumn = "";
  creditButton.style.gridColumn = "";

  const visibleOptions = [storeAllowed, true, creditAllowed].filter(Boolean).length;

  if (visibleOptions === 1) {
    pixButton.style.gridColumn = "1 / -1";
  } else if (visibleOptions === 2 && !storeAllowed && creditAllowed) {
    pixButton.style.gridColumn = "";
    creditButton.style.gridColumn = "";
  }

  chooseStep.classList.remove("hidden");
  resultStep.classList.add("hidden");
  resultStep.innerHTML = "";

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  setTimeout(() => guestName.focus(), 50);
}

function closeModal() {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  state.selectedProduct = null;
  state.reservation = null;
}

document.querySelectorAll("[data-close-modal]").forEach(el => {
  el.addEventListener("click", closeModal);
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !modal.classList.contains("hidden")) {
    closeModal();
  }
});

function getGuestName() {
  const value = guestName.value.trim();
  if (value.length < 2) {
    showToast("Coloque seu nome antes de continuar.");
    guestName.focus();
    return null;
  }
  return value;
}

async function reserveGift(method) {
  const name = getGuestName();
  if (!name) return null;

  const product = state.selectedProduct;
  if (!product) return null;

  const buttonMap = {
    store: document.getElementById("chooseStore"),
    pix: document.getElementById("choosePix"),
    credit: document.getElementById("chooseCredit")
  };

  const button = buttonMap[method];

  const oldText = button.innerHTML;
  button.disabled = true;
  button.innerHTML = "<b>Reservando...</b>";

  const { data, error } = await sb.rpc("reserve_product", {
    p_product_id: product.id,
    p_guest_name: name,
    p_method: method
  });

  button.disabled = false;
  button.innerHTML = oldText;

  if (error) {
    showToast(error.message || "Não conseguimos reservar este presente.");
    await loadProducts();
    return null;
  }

  state.reservation = data;
  return data;
}

document.getElementById("chooseStore").addEventListener("click", async () => {
  const product = state.selectedProduct;

  if (!product || product.cash_only || !product.store_url) {
    showToast("Este presente está disponível somente como contribuição em dinheiro.");
    return;
  }

  const reservation = await reserveGift("store");
  if (!reservation) return;

  const storeUrl = safeUrl(product.store_url);

  chooseStep.classList.add("hidden");
  resultStep.classList.remove("hidden");

  resultStep.innerHTML = `
    <div class="result-box">
      <div class="result-icon">🛒</div>
      <h2>Presente reservado!</h2>
      <p>
        Reservamos <b>${escapeHtml(product.name)}</b> para você por
        ${config.RESERVATION_HOURS} horas. Agora é só concluir a compra na loja.
      </p>

      <div class="result-actions">
        <a class="button button-dark" href="${storeUrl}" target="_blank" rel="noopener noreferrer">
          Abrir loja ↗
        </a>
        <button class="button button-light" id="confirmStorePurchase">
          ✓ Já fiz a compra
        </button>
      </div>

      <p class="reservation-note">
        Depois de comprar, volte aqui e clique em “Já fiz a compra”.
      </p>
    </div>
  `;

  document.getElementById("confirmStorePurchase").addEventListener("click", confirmStorePurchase);
  await loadProducts();
});

async function confirmStorePurchase() {
  if (!state.reservation?.reservation_token) return;

  const button = document.getElementById("confirmStorePurchase");
  button.disabled = true;
  button.textContent = "Confirmando...";

  const { error } = await sb.rpc("confirm_store_purchase", {
    p_token: state.reservation.reservation_token
  });

  if (error) {
    button.disabled = false;
    button.textContent = "✓ Já fiz a compra";
    showToast(error.message || "Não foi possível confirmar.");
    return;
  }

  resultStep.innerHTML = `
    <div class="result-box">
      <div class="result-icon">🥹</div>
      <h2>Obrigadíssimo!</h2>
      <p>Marcamos o presente como comprado. Ele não ficará disponível para outras pessoas. ♡</p>
      <button class="button button-dark full" data-finish>Voltar para a lista</button>
    </div>
  `;

  resultStep.querySelector("[data-finish]").addEventListener("click", closeModal);
  await loadProducts();
}

document.getElementById("choosePix").addEventListener("click", async () => {
  const reservation = await reserveGift("pix");
  if (!reservation) return;

  const product = state.selectedProduct;

  chooseStep.classList.add("hidden");
  resultStep.classList.remove("hidden");

  resultStep.innerHTML = `
    <div class="result-box">
      <div class="result-icon">💚</div>
      <h2>Via PIX</h2>
      <p>
        Para presentear com <b>${escapeHtml(product.name)}</b>, envie
        <b>${money(product.price)}</b> para:
      </p>

      <div class="pix-key-box" id="pixKey">${escapeHtml(config.PIX_KEY)}</div>
      <p><b>Titular:</b> ${escapeHtml(config.PIX_HOLDER)}</p>

      <div class="result-actions">
        <button class="button button-light" id="copyPix">📋 Copiar chave PIX</button>
        <button class="button button-dark" id="reportPix">✓ Já fiz o PIX</button>
      </div>

      <p class="reservation-note">
        O presente já está reservado. Depois que você avisar do PIX, nós confirmamos no painel.
      </p>
    </div>
  `;

  document.getElementById("copyPix").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(config.PIX_KEY);
      showToast("Chave PIX copiada! 💚");
    } catch {
      showToast(`PIX: ${config.PIX_KEY}`);
    }
  });

  document.getElementById("reportPix").addEventListener("click", () => reportPayment("pix"));
  await loadProducts();
});

async function reportPayment(method) {
  if (!state.reservation?.reservation_token) return;

  const buttonId = method === "credit" ? "reportCredit" : "reportPix";
  const button = document.getElementById(buttonId);

  if (button) {
    button.disabled = true;
    button.textContent = "Avisando...";
  }

  const { error } = await sb.rpc("report_payment", {
    p_token: state.reservation.reservation_token
  });

  if (error) {
    if (button) {
      button.disabled = false;
      button.textContent = method === "credit" ? "✓ Já fiz o pagamento" : "✓ Já fiz o PIX";
    }

    showToast(error.message || "Não foi possível registrar o aviso.");
    return;
  }

  resultStep.innerHTML = `
    <div class="result-box">
      <div class="result-icon">💌</div>
      <h2>Recebemos seu aviso!</h2>
      <p>
        O presente continua reservado e vamos conferir o pagamento no nosso painel.
        Muito obrigado! ♡
      </p>
      <button class="button button-dark full" data-finish>Voltar para a lista</button>
    </div>
  `;

  resultStep.querySelector("[data-finish]").addEventListener("click", closeModal);
}

document.getElementById("chooseCredit").addEventListener("click", async () => {
  const product = state.selectedProduct;

  if (!product || !product.payment_url) {
    showToast("Este presente não possui pagamento por cartão habilitado.");
    return;
  }

  const reservation = await reserveGift("credit");
  if (!reservation) return;

  const paymentUrl = safeUrl(product.payment_url);

  chooseStep.classList.add("hidden");
  resultStep.classList.remove("hidden");

  resultStep.innerHTML = `
    <div class="result-box">
      <div class="result-icon">💳</div>
      <h2>Pagamento no cartão</h2>
      <p>
        Reservamos <b>${escapeHtml(product.name)}</b> para você por
        ${config.RESERVATION_HOURS} horas.
        Clique abaixo para abrir o pagamento seguro do Mercado Pago.
      </p>

      <div class="result-actions">
        <a class="button button-dark"
           href="${paymentUrl}"
           target="_blank"
           rel="noopener noreferrer">
          Abrir Mercado Pago ↗
        </a>

        <button class="button button-light" id="reportCredit">
          ✓ Já fiz o pagamento
        </button>
      </div>

      <p class="reservation-note">
        Depois de pagar, volte aqui e clique em “Já fiz o pagamento”.
        Nós conferimos no Mercado Pago e confirmamos no painel.
      </p>
    </div>
  `;

  document.getElementById("reportCredit")
    .addEventListener("click", () => reportPayment("credit"));

  await loadProducts();
});

loadProducts();
