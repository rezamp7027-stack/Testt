(() => {
const sb=window.testtSupabase;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let products=[],categories=[],orders=[],orderItems=[],settings={};
const money=n=>new Intl.NumberFormat("fa-IR").format(Math.round(Number(n)||0))+" "+(settings.currency||"تومان");
const setMsg=(id,t,error=false)=>{const el=$("#"+id);if(!el)return;el.textContent=t||"";el.classList.toggle("error",!!error)};
const setBusy=(el,busy,label="ذخیره")=>{if(!el)return;el.disabled=busy;if(busy){el.dataset.label=el.textContent;el.textContent="در حال انجام…"}else if(el.dataset.label){el.textContent=el.dataset.label;delete el.dataset.label}};
const adminEmail=value=>{const v=String(value||"").trim().toLowerCase();if(!v)return null;return v.includes("@")?v:(v==="admin"?"admin@testt.local":null)};

async function ensureAdmin(){
  const {data:{user},error}=await sb.auth.getUser();
  if(error||!user)return null;
  const {data,error:adminError}=await sb.from("admins").select("email").ilike("email",user.email).maybeSingle();
  if(adminError||!data)return null;
  return user;
}
function showLogin(message=""){
  $("#login-panel").hidden=false;
  $("#app-shell").hidden=true;
  setMsg("login-error",message,!!message);
}
function showApp(){
  $("#login-panel").hidden=true;
  $("#app-shell").hidden=false;
}
function readableError(error,fallback="خطایی رخ داد."){
  if(!error)return fallback;
  const msg=String(error.message||error.details||error.hint||"").trim();
  if(msg)return msg;
  return fallback;
}

async function loadProducts(){
  const r=await sb.from("products").select("*").order("sort_order",{ascending:true});
  if(r.error)throw r.error;
  products=r.data||[];
}
async function loadCategories(){
  const r=await sb.from("menu_categories").select("*").order("sort_order",{ascending:true});
  if(r.error)throw r.error;
  categories=r.data||[];
}
async function loadOrders(){
  const r=await sb.from("orders").select("*").order("created_at",{ascending:false}).limit(100);
  if(r.error)throw r.error;
  orders=r.data||[];
}
async function loadOrderItems(){
  const r=await sb.from("order_items").select("order_id,product_id,quantity,unit_price");
  if(r.error)throw r.error;
  orderItems=r.data||[];
}
async function loadSettings(){
  const r=await sb.from("menu_settings").select("*").eq("id",1).maybeSingle();
  if(r.error)throw r.error;
  settings=r.data||{};
}
async function loadAll(){
  const results=await Promise.allSettled([loadProducts(),loadCategories(),loadOrders(),loadOrderItems(),loadSettings()]);
  const failures=results.filter(x=>x.status==="rejected");
  renderAll();
  if(failures.length){
    const msg=failures.map(x=>readableError(x.reason)).join(" | ");
    throw new Error("بخشی از اطلاعات پنل بارگذاری نشد: "+msg);
  }
}
function catName(slug){return categories.find(c=>c.slug===slug)?.name||slug}
function productName(id){return products.find(p=>String(p.id)===String(id))?.name||"محصول"}
function renderAll(){renderStats();renderProducts();renderCategories();renderOrders();renderRecent();fillSettings();fillCats()}
function renderStats(){
  const active=products.filter(p=>p.active).length;
  const available=products.filter(p=>p.active&&p.available).length;
  const signature=products.filter(p=>p.signature).length;
  $("#stats").innerHTML=[["محصولات",products.length],["فعال",active],["موجود",available],["سیگنچر",signature],["دسته‌ها",categories.length],["سفارش‌ها",orders.length]].map(x=>'<div class="stat"><span>'+x[0]+"</span><strong>"+x[1]+"</strong></div>").join("");
}
function renderProducts(){
  const q=($("#admin-search")?.value||"").trim().toLocaleLowerCase("fa");
  const filter=$("#admin-status")?.value||"all";
  const rows=products.filter(p=>{
    const text=[p.name,p.slug,p.category,p.description,p.ingredients].join(" ").toLocaleLowerCase("fa");
    const matches=!q||text.includes(q);
    const state=filter==="all"||(filter==="available"&&p.active&&p.available)||(filter==="unavailable"&&p.active&&!p.available)||(filter==="hidden"&&!p.active);
    return matches&&state;
  });
  $("#products-list").innerHTML=rows.length?rows.map(p=>'<div class="admin-row"><div class="admin-product"><div class="admin-icon">'+esc(p.icon||"✦")+'</div><div><b>'+esc(p.name)+'</b><small>'+esc(catName(p.category))+"</small></div></div><div>"+money(p.discount_price??p.price)+'</div><span class="admin-status '+(p.active&&p.available?"on":"off")+'">'+(p.active?(p.available?"فعال":"ناموجود"):"مخفی")+'</span><div class="admin-actions"><button data-edit="'+p.id+'">ویرایش</button><button data-toggle="'+p.id+'">'+(p.active?"مخفی":"نمایش")+'</button><button data-av="'+p.id+'">'+(p.available?"ناموجود":"موجود")+'</button><button class="danger" data-del="'+p.id+'">حذف</button></div></div>').join(""):'<div class="empty-state compact">محصولی پیدا نشد.</div>';
}
function renderCategories(){
  $("#categories-list").innerHTML=categories.length?categories.map(c=>'<div class="admin-row"><div><b>'+esc(c.name)+'</b><small>'+esc(c.slug)+"</small></div><div>رتبه "+c.sort_order+'</div><span class="admin-status '+(c.active?"on":"off")+'">'+(c.active?"نمایش":"مخفی")+'</span><div class="admin-actions"><button data-ce="'+c.id+'">ویرایش</button><button data-ct="'+c.id+'">'+(c.active?"مخفی":"نمایش")+'</button><button class="danger" data-cd="'+c.id+'">حذف</button></div></div>').join(""):'<div class="empty-state compact">دسته‌ای وجود ندارد.</div>';
}
const statusFa=s=>({pending:"در انتظار",paid:"پرداخت‌شده",processing:"در حال آماده‌سازی",shipped:"تحویل",completed:"تکمیل",cancelled:"لغو"})[s]||s;
function renderOrders(){
  $("#orders-list").innerHTML=orders.length?orders.map(o=>{
    const items=orderItems.filter(i=>String(i.order_id)===String(o.id)).map(i=>productName(i.product_id)+" × "+i.quantity).join(" · ");
    return '<div class="order-row"><div><b>'+esc(o.customer_name)+'</b><small>'+esc(o.customer_phone||"")+" · میز "+esc(o.table_number||"—")+'</small></div><div>'+money(o.total)+'</div><div>'+new Date(o.created_at).toLocaleString("fa-IR")+'</div><div><select data-os="'+o.id+'">'+["pending","paid","processing","shipped","completed","cancelled"].map(s=>'<option value="'+s+'" '+(s===o.status?"selected":"")+'>'+statusFa(s)+"</option>").join("")+'</select></div><div><div>'+esc(o.note||"")+"</div><small>"+esc(items)+"</small></div></div>";
  }).join(""):'<div class="empty-state compact">هنوز سفارشی ثبت نشده.</div>';
}
function renderRecent(){
  $("#recent-orders").innerHTML=orders.slice(0,5).map(o=>'<div class="admin-row"><div><b>'+esc(o.customer_name)+'</b></div><div>'+money(o.total)+'</div><div>'+statusFa(o.status)+'</div><div>'+new Date(o.created_at).toLocaleDateString("fa-IR")+"</div></div>").join("")||'<div class="empty-state compact">سفارشی وجود ندارد.</div>';
}
function fillCats(){
  const active=categories.filter(c=>c.active);
  $("#p-category").innerHTML=active.map(c=>'<option value="'+esc(c.slug)+'">'+esc(c.name)+"</option>").join("");
}
function fillSettings(){
  $("#set-name").value=settings.cafe_name||"";
  $("#set-phone").value=settings.phone||"";
  $("#set-address").value=settings.address||"";
  $("#set-instagram").value=settings.instagram||"";
  $("#set-hours").value=settings.opening_hours||"";
  $("#set-currency").value=settings.currency||"تومان";
  $("#set-logo").value=settings.logo_url||"";
  $("#set-title").value=settings.menu_title||"";
  $("#set-subtitle").value=settings.menu_subtitle||"";
}
const parseJsonArray=value=>{if(!String(value||"").trim())return[];try{const x=JSON.parse(value);return Array.isArray(x)?x:null}catch{return null}};
function editProduct(p){
  $("#product-dialog-title").textContent=p?"ویرایش محصول":"محصول جدید";
  $("#product-id").value=p?.id||"";
  $("#p-name").value=p?.name||"";
  $("#p-slug").value=p?.slug||"";
  $("#p-price").value=p?.price??"";
  $("#p-discount").value=p?.discount_price??"";
  $("#p-category").value=p?.category||categories.find(c=>c.active)?.slug||"";
  $("#p-sort").value=p?.sort_order??10;
  $("#p-image").value=p?.image_url||"";
  $("#p-icon").value=p?.icon||"✦";
  $("#p-badge").value=p?.badge||"";
  $("#p-description").value=p?.description||"";
  $("#p-ingredients").value=p?.ingredients||"";
  $("#p-sizes").value=JSON.stringify(p?.sizes||[]);
  $("#p-addons").value=JSON.stringify(p?.addons||[]);
  $("#p-active").checked=p?.active??true;
  $("#p-available").checked=p?.available??true;
  $("#p-popular").checked=p?.popular??false;
  $("#p-signature").checked=p?.signature??false;
  setMsg("product-form-error","");
  $("#product-dialog").showModal();
}
function editCat(c){
  $("#category-id").value=c?.id||"";
  $("#c-name").value=c?.name||"";
  $("#c-slug").value=c?.slug||"";
  $("#c-description").value=c?.description||"";
  $("#c-icon").value=c?.icon||"✦";
  $("#c-image").value=c?.image_url||"";
  $("#c-sort").value=c?.sort_order??10;
  $("#c-active").checked=c?.active??true;
  setMsg("category-form-error","");
  $("#category-dialog").showModal();
}

$("#login-form").onsubmit=async e=>{
  e.preventDefault();
  const button=e.submitter||$("#login-form button[type=submit]");
  setMsg("login-error","");
  setBusy(button,true);
  try{
    const email=adminEmail($("#username").value);
    if(!email)throw new Error("نام کاربری نامعتبر است.");
    const {error}=await sb.auth.signInWithPassword({email,password:$("#password").value});
    if(error)throw new Error("ورود انجام نشد: "+readableError(error,"نام کاربری یا رمز عبور نادرست است."));
    if(!await ensureAdmin()){await sb.auth.signOut({scope:"local"});throw new Error("این حساب دسترسی مدیر ندارد.");}
    showApp();
    await loadAll();
    setMsg("login-error","");
  }catch(error){showLogin(readableError(error,"ورود انجام نشد."))}
  finally{setBusy(button,false)}
};
$("#logout").onclick=async()=>{await sb.auth.signOut({scope:"local"});showLogin("از پنل خارج شدید.")};

$$("[data-tab]").forEach(button=>button.onclick=()=>{
  $$("[data-tab]").forEach(x=>x.classList.remove("active"));
  button.classList.add("active");
  $$(".admin-section").forEach(x=>x.classList.remove("active"));
  $("#tab-"+button.dataset.tab).classList.add("active");
});
$("#admin-search").oninput=renderProducts;
$("#admin-status").onchange=renderProducts;
$("#new-product").onclick=()=>editProduct();
$("#new-category").onclick=()=>editCat();
$("#close-product").onclick=()=>$("#product-dialog").close();
$("#cancel-product").onclick=()=>$("#product-dialog").close();
$("#close-category").onclick=()=>$("#category-dialog").close();
$("#cancel-category").onclick=()=>$("#category-dialog").close();

$("#product-form").onsubmit=async e=>{
  e.preventDefault();
  const button=e.submitter;
  setMsg("product-form-error","");
  setBusy(button,true);
  try{
    const sizes=parseJsonArray($("#p-sizes").value),addons=parseJsonArray($("#p-addons").value);
    if(!sizes||!addons)throw new Error("JSON سایز یا افزودنی نامعتبر است.");
    const name=$("#p-name").value.trim(),slug=$("#p-slug").value.trim().toLowerCase(),category=$("#p-category").value;
    const price=Number($("#p-price").value),discount=$("#p-discount").value===""?null:Number($("#p-discount").value);
    if(!name)throw new Error("نام محصول الزامی است.");
    if(!/^[a-z0-9-]+$/.test(slug))throw new Error("Slug فقط باید شامل حروف انگلیسی کوچک، عدد و خط تیره باشد.");
    if(!category)throw new Error("یک دسته فعال انتخاب کنید.");
    if(!Number.isFinite(price)||price<0)throw new Error("قیمت معتبر نیست.");
    if(discount!==null&&(!Number.isFinite(discount)||discount<0||discount>=price))throw new Error("قیمت تخفیف باید کمتر از قیمت اصلی باشد.");
    const id=$("#product-id").value;
    const payload={name,slug,price,discount_price:discount,category,image_url:$("#p-image").value.trim(),icon:$("#p-icon").value.trim()||"✦",badge:$("#p-badge").value.trim(),description:$("#p-description").value.trim(),ingredients:$("#p-ingredients").value.trim(),sizes,addons,sort_order:Number($("#p-sort").value)||0,active:$("#p-active").checked,available:$("#p-available").checked,popular:$("#p-popular").checked,signature:$("#p-signature").checked};
    const r=id?await sb.from("products").update(payload).eq("id",id):await sb.from("products").insert(payload);
    if(r.error)throw r.error;
    $("#product-dialog").close();
    await loadAll();
    setMsg("product-message","محصول با موفقیت ذخیره شد.");
  }catch(error){setMsg("product-form-error",readableError(error,"ذخیره محصول انجام نشد."),true)}
  finally{setBusy(button,false)}
};

$("#category-form").onsubmit=async e=>{
  e.preventDefault();
  const button=e.submitter;
  setMsg("category-form-error","");
  setBusy(button,true);
  try{
    const id=$("#category-id").value,old=categories.find(c=>String(c.id)===String(id)),slug=$("#c-slug").value.trim().toLowerCase();
    if(!$("#c-name").value.trim())throw new Error("نام دسته الزامی است.");
    if(!/^[a-z0-9-]+$/.test(slug))throw new Error("Slug فقط باید شامل حروف انگلیسی کوچک، عدد و خط تیره باشد.");
    if(categories.some(c=>String(c.id)!==String(id)&&c.slug===slug))throw new Error("این Slug قبلاً استفاده شده است.");
    if(old&&old.slug!==slug&&products.some(p=>p.category===old.slug))throw new Error("این دسته محصول دارد؛ ابتدا محصولات را به دسته دیگری منتقل کنید.");
    const payload={name:$("#c-name").value.trim(),slug,description:$("#c-description").value.trim(),icon:$("#c-icon").value.trim()||"✦",image_url:$("#c-image").value.trim(),sort_order:Number($("#c-sort").value)||0,active:$("#c-active").checked};
    const r=id?await sb.from("menu_categories").update(payload).eq("id",id):await sb.from("menu_categories").insert(payload);
    if(r.error)throw r.error;
    $("#category-dialog").close();
    await loadAll();
    setMsg("category-message","دسته با موفقیت ذخیره شد.");
  }catch(error){setMsg("category-form-error",readableError(error,"ذخیره دسته انجام نشد."),true)}
  finally{setBusy(button,false)}
};

$("#products-list").onclick=async e=>{
  const edit=e.target.closest("[data-edit]"),toggle=e.target.closest("[data-toggle]"),availability=e.target.closest("[data-av]"),del=e.target.closest("[data-del]");
  if(edit){editProduct(products.find(p=>String(p.id)===edit.dataset.edit));return}
  const target=toggle||availability||del;if(!target)return;
  const p=products.find(x=>String(x.id)===target.dataset[target.hasAttribute("data-toggle")?"toggle":target.hasAttribute("data-av")?"av":"del"]);
  if(!p)return;
  try{
    if(toggle){const r=await sb.from("products").update({active:!p.active}).eq("id",p.id);if(r.error)throw r.error;await loadAll();return}
    if(availability){const r=await sb.from("products").update({available:!p.available}).eq("id",p.id);if(r.error)throw r.error;await loadAll();return}
    if(del&&confirm("حذف «"+p.name+"»؟")){const r=await sb.from("products").delete().eq("id",p.id);if(r.error)throw r.error;await loadAll()}
  }catch(error){setMsg("product-message",readableError(error,"عملیات محصول انجام نشد."),true)}
};

$("#categories-list").onclick=async e=>{
  const edit=e.target.closest("[data-ce]"),toggle=e.target.closest("[data-ct]"),del=e.target.closest("[data-cd]");
  if(edit){editCat(categories.find(c=>String(c.id)===edit.dataset.ce));return}
  const target=toggle||del;if(!target)return;
  const c=categories.find(x=>String(x.id)===String(target.dataset[toggle?"ct":"cd"]));if(!c)return;
  try{
    if(toggle){const r=await sb.from("menu_categories").update({active:!c.active}).eq("id",c.id);if(r.error)throw r.error;await loadAll();return}
    if(del){
      if(products.some(p=>p.category===c.slug))throw new Error("این دسته محصول دارد؛ ابتدا محصولات را جابه‌جا کنید.");
      if(!confirm("حذف «"+c.name+"»؟"))return;
      const r=await sb.from("menu_categories").delete().eq("id",c.id);if(r.error)throw r.error;await loadAll();
    }
  }catch(error){setMsg("category-message",readableError(error,"عملیات دسته انجام نشد."),true)}
};

$("#orders-list").onchange=async e=>{
  const select=e.target.closest("[data-os]");if(!select)return;
  try{const r=await sb.from("orders").update({status:select.value}).eq("id",select.dataset.os);if(r.error)throw r.error;await loadAll();setMsg("order-message","وضعیت سفارش به‌روز شد.")}catch(error){setMsg("order-message",readableError(error,"به‌روزرسانی سفارش انجام نشد."),true)}
};

$("#settings-form").onsubmit=async e=>{
  e.preventDefault();
  const button=e.submitter;setMsg("settings-message","");setBusy(button,true);
  try{
    const payload={cafe_name:$("#set-name").value.trim(),phone:$("#set-phone").value.trim(),address:$("#set-address").value.trim(),instagram:$("#set-instagram").value.trim(),opening_hours:$("#set-hours").value.trim(),currency:$("#set-currency").value.trim()||"تومان",logo_url:$("#set-logo").value.trim(),menu_title:$("#set-title").value.trim(),menu_subtitle:$("#set-subtitle").value.trim()};
    const r=await sb.from("menu_settings").update(payload).eq("id",1);
    if(r.error)throw r.error;
    await loadSettings();fillSettings();setMsg("settings-message","تنظیمات با موفقیت ذخیره شد.");
  }catch(error){setMsg("settings-message",readableError(error,"ذخیره تنظیمات انجام نشد."),true)}
  finally{setBusy(button,false)}
};

(async()=>{
  try{
    const admin=await ensureAdmin();
    if(!admin){showLogin();return}
    showApp();
    await loadAll();
  }catch(error){
    showApp();
    setMsg("product-message",readableError(error,"بارگذاری پنل انجام نشد."),true);
  }
})();
})();