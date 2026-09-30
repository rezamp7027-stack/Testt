(() => {
  const sb = window.testtSupabase;
  const $ = (id) => document.getElementById(id);
  const loginPanel = $("login-panel"), dashboard = $("dashboard");
  const loginForm = $("login-form"), loginError = $("login-error");
  const productsEl = $("admin-products"), messageEl = $("admin-message");
  const dialog = $("product-dialog"), productForm = $("product-form"), formError = $("form-error");
  let products = [];

  const emailForUsername = (username) => username.trim().toLowerCase() === "admin" ? "admin@testt.local" : null;

  function setMessage(msg = "", error = false) {
    messageEl.textContent = msg;
    messageEl.classList.toggle("is-error", error);
  }
  function escapeHtml(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function render() {
    const q = $("admin-search").value.trim().toLowerCase();
    const filter = $("admin-status-filter").value;
    const rows = products.filter(p => {
      const matchesText = !q || [p.name,p.slug,p.category,p.description].some(v => String(v ?? "").toLowerCase().includes(q));
      const matchesStatus = filter === "all" || (filter === "active" ? p.active : !p.active);
      return matchesText && matchesStatus;
    });
    productsEl.innerHTML = rows.length ? rows.map(p => `
      <article class="admin-row">
        <div class="admin-product-main"><div class="product-icon">${escapeHtml(p.icon || "◻")}</div><div><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.slug)} · ${escapeHtml(p.category)}</small></div></div>
        <div class="admin-price">$${Number(p.price).toFixed(2)}</div>
        <span class="status ${p.active ? "is-active" : "is-inactive"}">${p.active ? "Active" : "Hidden"}</span>
        <div class="admin-actions">
          <button class="btn btn-secondary" data-edit="${p.id}" type="button">Edit</button>
          <button class="btn btn-secondary" data-toggle="${p.id}" type="button">${p.active ? "Hide" : "Show"}</button>
          <button class="btn btn-danger" data-delete="${p.id}" type="button">Delete</button>
        </div>
      </article>`).join("") : '<div class="admin-empty">No products found.</div>';
  }

  async function ensureAdmin() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { data, error } = await sb.from("admins").select("email").maybeSingle();
    if (error || !data || data.email.toLowerCase() !== (user.email || "").toLowerCase()) {
      await sb.auth.signOut(); return false;
    }
    return true;
  }

  async function loadProducts() {
    setMessage("Loading…");
    const { data, error } = await sb.from("products").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    products = data || [];
    render(); setMessage(`${products.length} products`);
  }

  function openEditor(p = null) {
    $("dialog-title").textContent = p ? "Edit product" : "Add product";
    $("product-id").value = p?.id || "";
    $("product-name").value = p?.name || "";
    $("product-slug").value = p?.slug || "";
    $("product-price").value = p?.price ?? "";
    $("product-category").value = p?.category || "";
    $("product-icon").value = p?.icon || "◻";
    $("product-active").value = String(p?.active ?? true);
    $("product-description").value = p?.description || "";
    formError.textContent = "";
    dialog.showModal();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault(); loginError.textContent = "";
    const email = emailForUsername($("username").value);
    if (!email) { loginError.textContent = "Invalid username."; return; }
    const { error } = await sb.auth.signInWithPassword({ email, password: $("password").value });
    if (error) { loginError.textContent = error.message; return; }
    if (!await ensureAdmin()) { loginError.textContent = "This account is not an authorized admin."; return; }
    loginPanel.hidden = true; dashboard.hidden = false; $("logout").hidden = false; $("admin-status").textContent = "admin";
    try { await loadProducts(); } catch (err) { setMessage(err.message, true); }
  });

  $("logout").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
  $("new-product").addEventListener("click", () => openEditor());
  $("close-dialog").addEventListener("click", () => dialog.close());
  $("cancel-product").addEventListener("click", () => dialog.close());
  $("admin-search").addEventListener("input", render);
  $("admin-status-filter").addEventListener("change", render);

  productsEl.addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-edit]"), toggle = e.target.closest("[data-toggle]"), del = e.target.closest("[data-delete]");
    if (edit) return openEditor(products.find(p => p.id === edit.dataset.edit));
    if (toggle) {
      const p = products.find(x => x.id === toggle.dataset.toggle); if (!p) return;
      toggle.disabled = true;
      const { error } = await sb.from("products").update({active: !p.active}).eq("id", p.id);
      toggle.disabled = false;
      if (error) return setMessage(error.message, true);
      await loadProducts();
    }
    if (del) {
      const p = products.find(x => x.id === del.dataset.delete); if (!p) return;
      if (!confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
      del.disabled = true;
      const { error } = await sb.from("products").delete().eq("id", p.id);
      del.disabled = false;
      if (error) return setMessage(error.message, true);
      await loadProducts();
    }
  });

  productForm.addEventListener("submit", async (e) => {
    e.preventDefault(); formError.textContent = "";
    const id = $("product-id").value;
    const payload = {
      name: $("product-name").value.trim(),
      slug: $("product-slug").value.trim().toLowerCase(),
      price: Number($("product-price").value),
      category: $("product-category").value.trim(),
      icon: $("product-icon").value.trim() || "◻",
      active: $("product-active").value === "true",
      description: $("product-description").value.trim()
    };
    if (!Number.isFinite(payload.price) || payload.price < 0) return formError.textContent = "Enter a valid price.";
    const result = id ? await sb.from("products").update(payload).eq("id", id) : await sb.from("products").insert(payload);
    if (result.error) return formError.textContent = result.error.message;
    dialog.close(); await loadProducts();
  });

  (async () => {
    if (await ensureAdmin()) {
      loginPanel.hidden = true; dashboard.hidden = false; $("logout").hidden = false; $("admin-status").textContent = "admin";
      try { await loadProducts(); } catch (err) { setMessage(err.message, true); }
    }
  })();
})();