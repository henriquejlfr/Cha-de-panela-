const config = window.APP_CONFIG;

const sb = window.supabase.createClient(
  config.SUPABASE_URL,
  config.SUPABASE_KEY
);

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const adminProducts = document.getElementById("adminProducts");
const stats = document.getElementById("stats");
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

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function showLogin() {
  loginView.classList.remove("hidden");
  dashboardView.classList.add("hidden");
}

function showDashboard() {
  loginView.classList.add("hidden");
  dashboardView.classList.remove("hidden");
  loadDashboard();
}

async function initAuth() {
  const { data } = await sb.auth.getSession();

  if (data.session) {
    showDashboard();
  } else {
    showLogin();
  }
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  loginError.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    loginError.textContent = "Não foi possível entrar. Confira e-mail e senha.";
    return;
  }

  showDashboard();
});

document.getElementById("logoutButton").addEventListener("click", async () => {
  await sb.auth.signOut();
  showLogin();
});

async function loadDashboard() {
  adminProducts.innerHTML = '<div class="loading">Carregando...</div>';

  const { data, error } = await sb
    .from("products")
    .select(`
      *,
      reservations (
        id,
        guest_name,
        method,
        status,
        payment_reported,
        created_at,
        expires_at,
        confirmed_at
      )
    `)
    .order("created_at", { ascending: true });

  if (error) {
    adminProducts.innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
    return;
  }

  renderStats(data || []);
  renderProducts(data || []);
}

function getReservation(product) {
  const reservation = product.reservations;

  if (!reservation) return null;
  if (Array.isArray(reservation)) return reservation.length ? reservation[0] : null;
  if (typeof reservation === "object") return reservation;

  return null;
}

function renderStats(products) {
  const total = products.length;
  const available = products.filter(p => p.status === "available").length;
  const reserved = products.filter(p => p.status === "reserved").length;
  const confirmed = products.filter(p => p.status === "confirmed").length;
  const totalConfirmed = products
    .filter(p => p.status === "confirmed")
    .reduce((sum, p) => sum + Number(p.price || 0), 0);

  stats.innerHTML = `
    <div class="stat"><span>Total</span><b>${total}</b></div>
    <div class="stat"><span>Disponíveis</span><b>${available}</b></div>
    <div class="stat"><span>Reservados</span><b>${reserved}</b></div>
    <div class="stat"><span>Confirmados</span><b>${confirmed}</b><small>${money(totalConfirmed)}</small></div>
  `;
}

function renderProducts(products) {
  if (!products.length) {
    adminProducts.innerHTML = '<div class="empty-state">Nenhum presente cadastrado.</div>';
    return;
  }

  adminProducts.innerHTML = products.map(product => {
    const reservation = getReservation(product);
    const method = reservation?.method === "pix" ? "PIX" : "Loja";
    const paymentNote = reservation?.method === "pix"
      ? (reservation.payment_reported ? " • convidado informou pagamento" : " • aguardando PIX")
      : "";

    return `
      <article class="admin-product">
        <div>
          <span class="status-text ${escapeHtml(product.status)}">
            ${statusLabel(product.status)}
          </span>
          <h3>${escapeHtml(product.name)}</h3>
          <p><strong>${money(product.price)}</strong> • ${escapeHtml(product.category || "Sem categoria")}</p>
          ${product.cash_only ? `<p>💚 <b>Somente dinheiro / PIX</b></p>` : ""}

          ${
            reservation
              ? `
                <p>🎁 <b>${escapeHtml(reservation.guest_name)}</b></p>
                <p>Forma: ${method}${paymentNote}</p>
                <p>Reserva: ${formatDate(reservation.created_at)}</p>
              `
              : `<p>Ninguém escolheu este presente ainda.</p>`
          }
        </div>

        <div class="admin-product-actions">
          ${
            reservation && product.status !== "confirmed"
              ? `<button class="mini-button success" data-confirm="${reservation.id}">Confirmar</button>`
              : ""
          }

          ${
            reservation
              ? `<button class="mini-button" data-release="${reservation.id}">Liberar</button>`
              : ""
          }

          <button class="mini-button danger" data-delete="${product.id}">Excluir</button>
        </div>
      </article>
    `;
  }).join("");

  bindAdminActions();
}

function statusLabel(status) {
  const labels = {
    available: "Disponível",
    reserved: "Reservado",
    confirmed: "Confirmado"
  };
  return labels[status] || status;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function bindAdminActions() {
  document.querySelectorAll("[data-confirm]").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;

      const { error } = await sb.rpc("admin_confirm_reservation", {
        p_reservation_id: button.dataset.confirm
      });

      if (error) {
        showToast(error.message);
        button.disabled = false;
        return;
      }

      showToast("Presente confirmado.");
      loadDashboard();
    });
  });

  document.querySelectorAll("[data-release]").forEach(button => {
    button.addEventListener("click", async () => {
      if (!confirm("Liberar este presente para outra pessoa?")) return;

      button.disabled = true;

      const { error } = await sb.rpc("admin_release_reservation", {
        p_reservation_id: button.dataset.release
      });

      if (error) {
        showToast(error.message);
        button.disabled = false;
        return;
      }

      showToast("Presente liberado.");
      loadDashboard();
    });
  });

  document.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", async () => {
      if (!confirm("Excluir este presente permanentemente?")) return;

      const { error } = await sb
        .from("products")
        .delete()
        .eq("id", button.dataset.delete);

      if (error) {
        showToast(error.message);
        return;
      }

      showToast("Presente excluído.");
      loadDashboard();
    });
  });
}

const cashOnlyCheckbox = document.getElementById("productCashOnly");
const storeUrlInput = document.getElementById("productStoreUrl");
const storeUrlField = document.getElementById("storeUrlField");
const storeRequiredMark = document.getElementById("storeRequiredMark");
const storeUrlHelp = document.getElementById("storeUrlHelp");

function updateStoreUrlField() {
  const cashOnly = cashOnlyCheckbox.checked;

  storeUrlInput.required = !cashOnly;
  storeUrlInput.disabled = cashOnly;
  storeRequiredMark.classList.toggle("hidden", cashOnly);
  storeUrlField.style.opacity = cashOnly ? "0.48" : "1";
  storeUrlHelp.textContent = cashOnly
    ? "Desativado porque este presente será recebido somente em dinheiro."
    : "Obrigatório para presentes que podem ser comprados em uma loja.";

  if (cashOnly) storeUrlInput.value = "";
}

cashOnlyCheckbox.addEventListener("change", updateStoreUrlField);
updateStoreUrlField();

document.getElementById("productForm").addEventListener("submit", async event => {
  event.preventDefault();

  const cashOnly = cashOnlyCheckbox.checked;

  const product = {
    name: document.getElementById("productName").value.trim(),
    price: Number(document.getElementById("productPrice").value),
    category: document.getElementById("productCategory").value.trim(),
    cash_only: cashOnly,
    store_url: cashOnly ? null : storeUrlInput.value.trim(),
    image_url: document.getElementById("productImageUrl").value.trim() || null,
    description: document.getElementById("productDescription").value.trim() || null
  };

  const { error } = await sb.from("products").insert(product);

  if (error) {
    showToast(error.message);
    return;
  }

  event.target.reset();
  updateStoreUrlField();
  showToast(cashOnly ? "Presente em dinheiro cadastrado! 💚" : "Presente cadastrado! 🎁");
  loadDashboard();
});

document.getElementById("refreshButton").addEventListener("click", loadDashboard);

initAuth();
