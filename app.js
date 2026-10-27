(() => {
  const STORAGE_KEY = "bookvault.library.v1";
  const $ = (id) => document.getElementById(id);
  const state = { books: loadBooks(), view: "all", layout: "grid", results: [], selected: null, editingId: null, installPrompt: null, scanner: null, scanBusy: false };
  const statusLabels = { reading: "READING", finished: "FINISHED", wishlist: "WANT TO READ" };
  const statusNames = { reading: "Currently reading", finished: "Finished", wishlist: "Want to read" };

  function loadBooks() {
    try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.books)); render(); }
  function esc(s="") { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function normalize(s="") { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,""); }
  function toast(message) { const el=$("toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),2600); }
  function openModal() {
    stopScanner(); state.selected=null; state.results=[]; state.editingId=null;
    $("modal-backdrop").classList.remove("hidden"); $("query-title").value=""; $("query-author").value="";
    $("lookup-message").textContent=""; $("lookup-message").className="lookup-message";
    $("search-results").innerHTML=""; $("results-heading").classList.add("hidden"); $("manual-area").classList.add("hidden");
    $("selected-edition").classList.add("hidden"); $("edit-fields").classList.add("hidden"); $("duplicate-warning").classList.add("hidden");
    $("lookup-form").classList.remove("hidden"); $("modal-intro").textContent="Search by title and author. We'll look across book catalogues and let you choose the right edition.";
    setAddMode("search"); $("scanner-status").textContent=""; $("bulk-input").value=""; $("bulk-status-message").textContent="";
    $("modal-title").innerHTML='Find a book<span class="gold-text">.</span>';
    setTimeout(()=>$("query-title").focus(),100);
  }
  function closeModal(){ stopScanner(); $("modal-backdrop").classList.add("hidden"); }
  function setMessage(message,error=false){ $("lookup-message").textContent=message; $("lookup-message").className="lookup-message"+(error?" error":""); }
  function coverUrl(book) {
    if (book.cover) return book.cover;
    if (book.isbn) return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(book.isbn)}-M.jpg?default=false`;
    return "";
  }
  function placeholder(title,author) {
    return `<div class="cover-placeholder"><span class="mini-mark">BV</span><span class="placeholder-title">${esc(title)}</span><small>${esc(author||"UNKNOWN AUTHOR")}</small></div>`;
  }
  function cardCover(book) {
    const url=coverUrl(book);
    if (!url) return placeholder(book.title,book.author);
    return `<img loading="lazy" src="${esc(url)}" alt="Cover of ${esc(book.title)}" onerror="this.outerHTML='${placeholder(book.title,book.author).replace(/'/g,"&#39;")}'">`;
  }
  function render() {
    const total=state.books.length, reading=state.books.filter(b=>b.status==="reading").length, finished=state.books.filter(b=>b.status==="finished").length;
    $("stat-total").innerHTML=`${total} <i>${total===1?"book":"books"}</i>`; $("stat-reading").innerHTML=`${reading} <i>${reading===1?"book":"books"}</i>`; $("stat-finished").innerHTML=`${finished} <i>${finished===1?"book":"books"}</i>`;
    $("side-total").textContent=total;
    const continueBooks = state.books.filter(b=>b.status==="reading").slice(0,4);
    const shownContinue = continueBooks.length ? continueBooks : state.books.slice(0,4);
    $("continue-books").innerHTML = shownContinue.length ? shownContinue.map(book => `
      <button class="continue-book" type="button" data-continue-id="${esc(book.id)}" aria-label="Open ${esc(book.title)}">
        <span class="continue-cover">${cardCover(book)}</span>
        <span class="continue-title">${esc(book.title)}</span>
        <small>${esc(book.author||"Unknown author")}</small>
      </button>`).join("") : `<div class="continue-empty"><span>♡</span><strong>Your next chapter awaits.</strong><small>Add a book to see it here.</small></div>`;
    const search=normalize($("local-search").value||""), sort=$("sort-select").value;
    let list=state.books.filter(b=>state.view==="all"||b.status===state.view);
    if(search) list=list.filter(b=>normalize([b.title,b.author,b.genre,b.description,b.year].join(" ")).includes(search));
    list.sort((a,b)=>sort==="title"?a.title.localeCompare(b.title):sort==="author"?a.author.localeCompare(b.author):sort==="year"?(Number(b.year)||0)-(Number(a.year)||0):(b.addedAt||0)-(a.addedAt||0));
    $("crumb-view").textContent=(state.view==="all"?"ALL BOOKS":statusLabels[state.view]).toUpperCase();
    $("collection-title").innerHTML=(state.view==="all"?"Your bookshelf":statusNames[state.view])+'<span class="gold-text">.</span>';
    document.querySelectorAll("[data-view]").forEach(btn=>btn.classList.toggle("active",btn.dataset.view===state.view));
    document.querySelectorAll("[data-filter]").forEach(btn=>btn.classList.toggle("active",btn.dataset.filter===state.view));
    const grid=$("book-grid"); grid.classList.toggle("list-layout",state.layout==="list");
    document.querySelectorAll("[data-layout]").forEach(btn=>btn.classList.toggle("selected",btn.dataset.layout===state.layout));
    grid.innerHTML=list.map(book=>`<article class="book-card" data-book-id="${esc(book.id)}" tabindex="0" aria-label="View ${esc(book.title)}">
      <div class="cover-wrap">${cardCover(book)}<span class="status-badge">${esc(statusLabels[book.status]||"WANT TO READ")}</span><button class="card-menu" data-action="menu" data-id="${esc(book.id)}" aria-label="Book actions">⋯</button></div>
      <div class="book-meta"><h3>${esc(book.title)}</h3><p>${esc(book.author||"Unknown author")}</p><div class="year">${esc(book.year||book.publisher||"")}</div></div></article>`).join("");
    $("empty-state").classList.toggle("hidden",list.length>0);
    grid.classList.toggle("hidden",list.length===0);
    if(search&&list.length===0){$("empty-state").innerHTML=`<div class="empty-icon">⌕</div><h3>No books found.</h3><p>Try another title or author, or add a new book to your vault.</p><button class="primary-btn" id="empty-add-search">＋ Add a book</button>`; $("empty-add-search").onclick=openModal;}
    else if(total===0){$("empty-state").innerHTML=`<div class="empty-icon">✧</div><h3>Your story starts here.</h3><p>Add your first book and BookVault will find its cover and details for you.</p><button class="primary-btn" id="empty-add">＋ Find your first book</button>`; $("empty-add").onclick=openModal;}
    else if(list.length===0){$("empty-state").innerHTML=`<div class="empty-icon">✧</div><h3>No books in this shelf yet.</h3><p>Books with this status will appear here.</p><button class="primary-btn" id="empty-add-filter">＋ Add a book</button>`; $("empty-add-filter").onclick=openModal;}
  }

  async function searchGoogle(title,author) {
    const q=[`intitle:${title}`,author?`inauthor:${author}`:""].filter(Boolean).join("+");
    const url=`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=20&printType=books`;
    const res=await fetch(url); if(!res.ok) throw new Error("Google Books is temporarily unavailable."); const data=await res.json();
    return (data.items||[]).map(item=>{
      const v=item.volumeInfo||{}, ids=v.industryIdentifiers||[];
      const isbn13=(ids.find(i=>i.type==="ISBN_13")||{}).identifier||"";
      const isbn10=(ids.find(i=>i.type==="ISBN_10")||{}).identifier||"";
      let image=(v.imageLinks||{}).thumbnail||(v.imageLinks||{}).smallThumbnail||"";
      image=image.replace(/^http:/,"https:").replace(/&zoom=\d+/,"&zoom=2");
      return {source:"Google Books",sourceId:item.id,title:v.title||title,subtitle:v.subtitle||"",author:(v.authors||[]).join(", "),year:(v.publishedDate||"").slice(0,4),publishedDate:v.publishedDate||"",publisher:v.publisher||"",description:v.description||"",genre:(v.categories||[]).join(", "),pageCount:v.pageCount||"",language:v.language||"",isbn:isbn13||isbn10,cover:image,infoLink:v.infoLink||"",editionLabel:[v.publisher,v.publishedDate,(v.pageCount?`${v.pageCount} pages`:""),v.language].filter(Boolean).join(" · ")};
    });
  }
  async function searchOpenLibrary(title,author) {
    const params=new URLSearchParams({title,limit:"20"});
    if(author) params.set("author",author);
    params.set("fields","key,title,author_name,first_publish_year,edition_count,cover_i,isbn,publisher,subject,number_of_pages_median,language");
    const res=await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
    if(!res.ok) throw new Error("Open Library is temporarily unavailable."); const data=await res.json();
    return (data.docs||[]).map(d=>({source:"Open Library",sourceId:d.key,title:d.title||title,author:(d.author_name||[]).join(", "),year:d.first_publish_year?String(d.first_publish_year):"",publisher:(d.publisher||[])[0]||"",description:"",genre:(d.subject||[]).slice(0,3).join(", "),isbn:(d.isbn||[])[0]||"",cover:d.cover_i?`https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`:"",editionLabel:`${d.edition_count||"Multiple"} editions${d.first_publish_year?" · first published "+d.first_publish_year:""}${d.number_of_pages_median?" · "+d.number_of_pages_median+" pages":""}`,infoLink:d.key?`https://openlibrary.org${d.key}`:""}));
  }
  function setAddMode(mode) {
    document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
    $("lookup-form").classList.toggle("hidden",mode!=="search");
    $("scanner-panel").classList.toggle("hidden",mode!=="scan");
    $("bulk-panel").classList.toggle("hidden",mode!=="bulk");
    if(mode!=="scan") stopScanner();
  }
  async function lookupIsbn(raw) {
    const isbn=String(raw||"").replace(/[^0-9Xx]/g,"");
    if(!isbn){$("scanner-status").textContent="Scan a barcode or enter an ISBN first.";return;}
    $("isbn-input").value=isbn; $("scanner-status").textContent=`Looking up ISBN ${isbn}…`;
    stopScanner();
    let results=[];
    const outcomes=await Promise.allSettled([
      fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent("isbn:"+isbn)}&maxResults=10`).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>(d.items||[]).map(item=>{const v=item.volumeInfo||{},ids=v.industryIdentifiers||[];let image=(v.imageLinks||{}).thumbnail||(v.imageLinks||{}).smallThumbnail||"";return {source:"Google Books",sourceId:item.id,title:v.title||"",subtitle:v.subtitle||"",author:(v.authors||[]).join(", "),year:(v.publishedDate||"").slice(0,4),publisher:v.publisher||"",description:v.description||"",genre:(v.categories||[]).join(", "),isbn:((ids.find(x=>x.type==="ISBN_13")||{}).identifier)||isbn,cover:image.replace(/^http:/,"https:"),editionLabel:[v.publisher,v.publishedDate,v.pageCount?`${v.pageCount} pages`:""].filter(Boolean).join(" · ")};})),
      fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`).then(r=>{if(!r.ok)throw Error();return r.json();}).then(async d=>{let author="";if(d.authors&&d.authors[0]?.key){try{const a=await fetch(`https://openlibrary.org${d.authors[0].key}.json`).then(r=>r.json());author=a.name||"";}catch{}}return [{source:"Open Library",sourceId:d.key,title:d.title||"",author,year:d.publish_date?String(d.publish_date).match(/\d{4}/)?.[0]||"":"",publisher:(d.publishers||[])[0]||"",description:typeof d.description==="string"?d.description:"",genre:(d.subjects||[]).slice(0,3).join(", "),isbn,cover:`https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg?default=false`,editionLabel:[d.publish_date,(d.number_of_pages?`${d.number_of_pages} pages`:"")].filter(Boolean).join(" · ")}];})
    ]);
    outcomes.forEach(o=>{if(o.status==="fulfilled")results.push(...o.value);});
    results=results.filter(r=>r.title);
    if(!results.length){$("scanner-status").textContent="No catalogue match for this ISBN. Try the title search or enter the details manually.";return;}
    state.results=results; $("search-results").innerHTML=results.map((r,i)=>`<button class="result-item" data-result="${i}">${r.cover?`<img class="result-cover" src="${esc(r.cover)}" alt="" onerror="this.outerHTML='<div class=&quot;result-cover-placeholder&quot;>BV</div>'">`:`<div class="result-cover-placeholder">BV</div>`}<span class="result-copy"><strong>${esc(r.title)}</strong><span>${esc(r.author||"Author unknown")}</span><small>${esc(r.source)} · ISBN ${esc(isbn)}${r.editionLabel?" · "+esc(r.editionLabel):""}</small></span><span class="result-select">Select →</span></button>`).join("");
    $("results-heading").classList.remove("hidden"); $("result-count").textContent=`${results.length} matches`; $("scanner-status").textContent="ISBN found. Choose the matching edition below."; $("manual-area").classList.remove("hidden");
  }
  async function startScanner() {
    if(!navigator.mediaDevices?.getUserMedia){$("scanner-status").textContent="Camera access isn't available in this browser. Enter the ISBN manually instead.";return;}
    if(typeof Html5Qrcode==="undefined"){$("scanner-status").textContent="The scanner library couldn't load. Check your connection, then try again or enter ISBN manually.";return;}
    try {
      stopScanner(); state.scanner=new Html5Qrcode("reader",{formatsToSupport:[Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E,Html5QrcodeSupportedFormats.CODE_128], verbose:false}); $("scanner-status").textContent="Requesting camera permission…";
      await state.scanner.start({facingMode:"environment"},{fps:15,qrbox:(viewWidth,viewHeight)=>({width:Math.min(viewWidth-24,420),height:Math.min(160,Math.floor(viewHeight*0.45))}),aspectRatio:2.5,disableFlip:true},decodedText=>{if(state.scanBusy)return;state.scanBusy=true;const clean=String(decodedText).replace(/[^0-9]/g,"");$("isbn-input").value=clean;$("scanner-status").textContent=`Barcode detected: ${clean}`;lookupIsbn(clean).finally(()=>{state.scanBusy=false;});},()=>{});
      $("start-scan").classList.add("hidden"); $("stop-scan").classList.remove("hidden"); $("scanner-status").textContent="Camera is running. Hold the barcode steady inside the frame.";
    } catch(err) { state.scanner=null; $("scanner-status").textContent="Couldn't start the camera. Allow camera access and make sure you're using the hosted HTTPS app. You can enter the ISBN manually below."; }
  }
  function stopScanner() {
    if(state.scanner){const scanner=state.scanner;state.scanner=null;try{const p=scanner.stop();if(p&&p.then)p.then(()=>scanner.clear()).catch(()=>{});else scanner.clear();}catch{}}
    const start=$("start-scan"),stop=$("stop-scan");if(start)start.classList.remove("hidden");if(stop)stop.classList.add("hidden");
  }
  function bulkAdd() {
    const lines=$("bulk-input").value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(!lines.length){$("bulk-status-message").textContent="Paste at least one title and author.";return;}
    let added=0,duplicates=0;
    lines.forEach(line=>{const parts=line.split(/\s+[—–-]\s+|\s*,\s*/);const title=(parts.shift()||"").trim();const author=parts.join(", ").trim();if(!title)return;
      const dup=state.books.some(b=>normalize(b.title)===normalize(title)&&normalize(b.author)===normalize(author));if(dup){duplicates++;return;}
      state.books.unshift({id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,title,author,year:"",genre:"",description:"",cover:"",isbn:"",source:"Bulk entry",status:$("bulk-status").value,addedAt:Date.now()});added++;
    });
    persist();$("bulk-status-message").textContent=`Added ${added} book${added===1?"":"s"}${duplicates?`; skipped ${duplicates} likely duplicate${duplicates===1?"":"s"}`:""}. You can edit any entry later to fetch metadata and cover.`;if(added)toast(`${added} book${added===1?"":"s"} added to your vault.`);
  }

  async function doLookup(event) {
    event.preventDefault(); const title=$("query-title").value.trim(), author=$("query-author").value.trim();
    if(!title){setMessage("Enter a book title to begin.",true);return;}
    $("search-results").innerHTML=""; $("results-heading").classList.add("hidden"); $("manual-area").classList.add("hidden"); $("edit-fields").classList.add("hidden"); $("selected-edition").classList.add("hidden");
    setMessage("Searching Google Books and Open Library…");
    $("lookup-form").querySelector("button").disabled=true;
    const outcomes=await Promise.allSettled([searchGoogle(title,author),searchOpenLibrary(title,author)]);
    $("lookup-form").querySelector("button").disabled=false;
    let results=[]; outcomes.forEach(o=>{if(o.status==="fulfilled")results.push(...o.value);});
    // Keep both sources but de-prioritize exact duplicate title/author/source records.
    const seen=new Set(); results=results.filter(r=>{const key=normalize(r.title)+"|"+normalize(r.author)+"|"+normalize(r.year)+"|"+r.source;if(seen.has(key))return false;seen.add(key);return true;});
    results.sort((a,b)=>(normalize(a.title)===normalize(title)?-1:0)-(normalize(b.title)===normalize(title)?-1:0));
    state.results=results.slice(0,30);
    if(!results.length){
      const failed=outcomes.every(o=>o.status==="rejected");
      setMessage(failed?"Could not reach the book catalogues. Check your connection and try again, or enter the details manually.":"No matching editions found. You can still save this book manually.");
      $("manual-area").classList.remove("hidden"); $("manual-save").textContent="Enter details manually"; return;
    }
    setMessage(`Found ${results.length} possible match${results.length===1?"":"es"}. Choose the edition that looks like your copy.`);
    $("results-heading").classList.remove("hidden"); $("result-count").textContent=`${results.length} matches`;
    $("manual-area").classList.remove("hidden"); $("manual-save").textContent="Can't find the right edition? Enter manually";
    $("search-results").innerHTML=results.map((r,i)=>`<button class="result-item" data-result="${i}">
      ${r.cover?`<img class="result-cover" src="${esc(r.cover)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;result-cover-placeholder&quot;>BV</div>'">`:`<div class="result-cover-placeholder">BV</div>`}
      <span class="result-copy"><strong>${esc(r.title)}${r.subtitle?`: ${esc(r.subtitle)}`:""}</strong><span>${esc(r.author||"Author unknown")}</span><small>${esc(r.source)}${r.editionLabel?" · "+esc(r.editionLabel):""}${r.isbn?" · ISBN "+esc(r.isbn):""}</small></span><span class="result-select">Select →</span></button>`).join("");
  }
  function selectResult(index) {
    state.selected=state.results[index]; state.editingId=null;
    document.querySelectorAll(".result-item").forEach((el,i)=>el.classList.toggle("selected",i===index));
    showEditForm(state.selected);
  }
  function showEditForm(book,existing=null) {
    $("selected-edition").classList.remove("hidden");
    const url=coverUrl(book);
    $("selected-edition").innerHTML=`${url?`<img src="${esc(url)}" alt="" onerror="this.style.display='none'">`:`<div class="result-cover-placeholder">BV</div>`}<div><strong>${esc(book.title)}</strong><p>${esc(book.author||"Unknown author")} · ${esc(book.source||"Manual entry")}</p></div>`;
    $("edit-fields").classList.remove("hidden");
    $("edit-title").value=book.title||""; $("edit-author").value=book.author||""; $("edit-genre").value=book.genre||""; $("edit-year").value=book.year||""; $("edit-description").value=book.description||""; $("edit-status").value=existing?.status||"wishlist";
    $("back-results").classList.toggle("hidden",!state.results.length&&!existing);
    $("save-book").textContent=existing?"Save changes →":"Save to my vault →";
    checkDuplicate();
  }
  function manualEntry() {
    state.selected={source:"Manual",title:$("query-title").value.trim(),author:$("query-author").value.trim(),year:"",genre:"",description:"",cover:"",isbn:""};
    state.editingId=null; $("selected-edition").classList.add("hidden");
    $("edit-fields").classList.remove("hidden"); $("edit-title").value=state.selected.title; $("edit-author").value=state.selected.author; $("edit-genre").value=""; $("edit-year").value=""; $("edit-description").value=""; $("edit-status").value="wishlist";
    $("back-results").classList.add("hidden"); $("save-book").textContent="Save to my vault →"; checkDuplicate();
  }
  function checkDuplicate() {
    const title=normalize($("edit-title").value), author=normalize($("edit-author").value);
    const matches=state.books.filter(b=>b.id!==state.editingId&&normalize(b.title)===title&&(!author||!b.author||normalize(b.author)===author));
    const warning=$("duplicate-warning");
    if(matches.length){warning.innerHTML=`<strong>Possible duplicate:</strong> “${esc(matches[0].title)}” by ${esc(matches[0].author||"Unknown author")} is already in your vault. You can still save another edition if this is a different copy.`;warning.classList.remove("hidden");}
    else warning.classList.add("hidden");
  }
  function saveBook() {
    const title=$("edit-title").value.trim(); if(!title){$("edit-title").focus();return;}
    const author=$("edit-author").value.trim(), year=$("edit-year").value.trim();
    const existing=state.editingId?state.books.find(b=>b.id===state.editingId):null;
    const book={...(state.selected||{}),id:existing?.id||`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,title,author,year,genre:$("edit-genre").value.trim(),description:$("edit-description").value.trim(),status:$("edit-status").value,addedAt:existing?.addedAt||Date.now(),updatedAt:Date.now()};
    if(existing) state.books=state.books.map(b=>b.id===existing.id?book:b); else state.books.unshift(book);
    persist(); closeModal(); toast(existing?"Book details updated.":"Added to your vault."); state.view="all"; render();
  }
  function bookMenu(id) {
    const b=state.books.find(x=>x.id===id); if(!b)return;
    const choice=prompt(`Actions for "${b.title}"\nType: reading, finished, wishlist, edit, delete`,b.status);
    if(choice===null)return;
    const v=choice.trim().toLowerCase();
    if(["reading","finished","wishlist"].includes(v)){b.status=v;persist();toast("Reading status updated.");}
    else if(v==="delete"){if(confirm(`Remove "${b.title}" from your vault?`)){state.books=state.books.filter(x=>x.id!==id);persist();toast("Book removed.");}}
    else if(v==="edit"){state.editingId=id;state.selected={...b};state.results=[];openModal();state.editingId=id;state.selected={...b};$("modal-title").innerHTML='Edit book<span class="gold-text">.</span>';$("query-title").value=b.title;$("query-author").value=b.author;$("lookup-form").classList.add("hidden");$("modal-intro").textContent="Update the details and reading status for this book.";showEditForm(b,b);$("back-results").classList.add("hidden");}
  }
  function exportBackup() {
    const blob=new Blob([JSON.stringify({app:"BookVault",version:1,exportedAt:new Date().toISOString(),books:state.books},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`bookvault-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);toast("Library backup exported.");
  }
  function importBackup(file) {
    const reader=new FileReader(); reader.onload=()=>{try{const data=JSON.parse(reader.result),incoming=Array.isArray(data)?data:data.books;if(!Array.isArray(incoming))throw new Error();if(!confirm(`Import ${incoming.length} books? Existing books with matching IDs will be replaced; other books will be kept.`))return;const map=new Map(state.books.map(b=>[b.id,b]));incoming.forEach((b,i)=>{if(b&&b.title){const key=b.id||`import-${Date.now()}-${i}`;map.set(key,{...b,id:key,addedAt:b.addedAt||Date.now()});}});state.books=[...map.values()];persist();toast("Backup imported successfully.");}catch{toast("That file doesn't look like a BookVault backup.");}};reader.readAsText(file);
  }
  document.querySelectorAll("[data-view]").forEach(btn=>btn.addEventListener("click",()=>{state.view=btn.dataset.view;render();window.scrollTo({top:0,behavior:"smooth"});}));
  document.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{state.view=btn.dataset.filter;render();}));
  document.querySelectorAll("[data-layout]").forEach(btn=>btn.addEventListener("click",()=>{state.layout=btn.dataset.layout;render();}));
  $("hero-add").onclick=$("section-add").onclick=$("empty-add").onclick=$("mobile-add").onclick=openModal;
  $("quick-add").onclick=openModal;
  $("quick-scan").onclick=()=>{openModal();setAddMode("scan");};
  $("quick-library").onclick=()=>{state.view="all";render();$("collection-title").scrollIntoView({behavior:"smooth",block:"start"});};
  $("quick-stats").onclick=()=>$("dashboard-stats").scrollIntoView({behavior:"smooth",block:"center"});
  $("continue-view-all").onclick=()=>{state.view="reading";render();$("collection-title").scrollIntoView({behavior:"smooth",block:"start"});};
  $("continue-books").addEventListener("click",e=>{const card=e.target.closest("[data-continue-id]");if(card){const book=state.books.find(b=>b.id===card.dataset.continueId);if(book)bookMenu(book.id);}});
  $("close-modal").onclick=closeModal; $("modal-backdrop").addEventListener("click",e=>{if(e.target===$("modal-backdrop"))closeModal();});
  $("lookup-form").addEventListener("submit",doLookup); $("search-results").addEventListener("click",e=>{const item=e.target.closest("[data-result]");if(item)selectResult(Number(item.dataset.result));});
  $("manual-save").onclick=manualEntry; $("save-book").onclick=saveBook; $("back-results").onclick=()=>{$("edit-fields").classList.add("hidden");$("selected-edition").classList.add("hidden");document.querySelectorAll(".result-item").forEach(el=>el.classList.remove("selected"));};
  ["edit-title","edit-author"].forEach(id=>$(id).addEventListener("input",checkDuplicate));
  $("local-search").addEventListener("input",render); $("sort-select").addEventListener("change",render);
  $("book-grid").addEventListener("click",e=>{const menu=e.target.closest("[data-action=menu]");if(menu){e.stopPropagation();bookMenu(menu.dataset.id);return;}const card=e.target.closest("[data-book-id]");if(card)bookMenu(card.dataset.bookId);});
  $("book-grid").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches("[data-book-id]")){e.preventDefault();bookMenu(e.target.dataset.bookId);}});
  $("export-btn").onclick=exportBackup; $("import-input").addEventListener("change",e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value="";});
  document.querySelectorAll("[data-mode]").forEach(btn=>btn.addEventListener("click",()=>setAddMode(btn.dataset.mode)));
  $("start-scan").onclick=startScanner; $("stop-scan").onclick=stopScanner; $("isbn-search").onclick=()=>lookupIsbn($("isbn-input").value);
  $("isbn-input").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();lookupIsbn(e.target.value);}});
  $("bulk-save").onclick=bulkAdd;
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();if(e.key==="/"&&!["INPUT","TEXTAREA"].includes(document.activeElement.tagName)&&$("modal-backdrop").classList.contains("hidden")){e.preventDefault();$("local-search").focus();}});
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.installPrompt=e;$("install-btn").classList.remove("hidden");});
  $("install-btn").onclick=async()=>{if(!state.installPrompt){toast("Use your browser menu and choose Add to Home Screen.");return;}state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;$("install-btn").classList.add("hidden");};
  if("serviceWorker" in navigator && location.protocol!=="file:") window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  const welcomeScreen = $("welcome-screen");
  const libraryScreen = $("library-screen");
  $("enter-library").addEventListener("click", () => {
    welcomeScreen.classList.add("welcome-leaving");
    window.setTimeout(() => {
      welcomeScreen.classList.add("is-hidden");
      libraryScreen.classList.remove("is-hidden");
      window.scrollTo({top:0,behavior:"instant"});
    }, 420);
  });
  render();
})();