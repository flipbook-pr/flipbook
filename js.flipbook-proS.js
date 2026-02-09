(() => {
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

        // =============================================
        // 🛠️ DYNAMIC INTERFACE INJECTION
        // =============================================
        const appInterfaceHTML = `
            <audio id="fbpS-sound" src="https://assets.mixkit.co/active_storage/sfx/2070/2070-preview.mp3"></audio>
            <div id="fbpS-toast" class="fbpS-toast">Bookmark saved!</div>

            <div id="fbpS-loader" class="fbpS-loader-container">
                <div class="fbpS-loader"></div>
                <div id="fbpS-loader-text" class="fbpS-loader-text">Initializing...</div>
            </div>

            <div id="fbpS-popup" class="fbpS-overlay">
                <div id="fbpS-btn-close" class="fbpS-close-btn" title="Close App"><i class="fas fa-times"></i></div>
                
                <div class="fbpS-sidebar" id="fbpS-sidebar">
                    <div class="fbpS-sidebar-header">
                        <span>Page list</span>
                        <div id="fbpS-sidebar-close" class="fbpS-sidebar-close-icon" title="Close List">
                            <i class="fas fa-times"></i>
                        </div>
                    </div>
                    <div id="fbpS-thumb-container"></div>
                </div>

                <div class="fbpS-arrow fbpS-prev" id="fbpS-float-prev"><i class="fas fa-chevron-left"></i></div>
                <div class="fbpS-arrow fbpS-next" id="fbpS-float-next"><i class="fas fa-chevron-right"></i></div>

                <div class="fbpS-stage" id="fbpS-stage">
                    <div class="fbpS-zoom-layer" id="fbpS-zoom-layer"></div>
                </div>

                <div class="fbpS-controls" id="fbpS-controls">
                    <button class="fbpS-btn" id="fbpS-btn-thumbs" title="Toggle Page List"><i class="fas fa-th-large"></i></button>
                    <div class="fbpS-divider"></div>
                    <button class="fbpS-btn" id="fbpS-btn-autoplay" title="Auto Play"><i class="fas fa-play"></i></button>
                    <button class="fbpS-btn" id="fbpS-btn-bookmark" title="Bookmark"><i class="far fa-bookmark"></i></button>
                    <button class="fbpS-btn" id="fbpS-btn-load-mark" style="display:none; color: var(--fbpS-accent);" title="Go to Bookmark"><i class="fas fa-history"></i></button>
                    <div class="fbpS-divider"></div>
                    <button class="fbpS-btn" id="fbpS-btn-zoom-out" title="Zoom Out"><i class="fas fa-minus"></i></button>
                    <button class="fbpS-btn" id="fbpS-btn-zoom-in" title="Zoom In"><i class="fas fa-plus"></i></button>
                    <button class="fbpS-btn" id="fbpS-btn-fullscreen" title="Full Screen"><i class="fas fa-expand"></i></button>
                    <div class="fbpS-divider"></div>
                    <input type="number" id="fbpS-page-input" class="fbpS-page-input" value="0">
                    <span class="fbpS-total-page">/ <span id="fbpS-total-pages">0</span></span>
                </div>
            </div>
        `;
        
        document.getElementById('fbpS-root').insertAdjacentHTML('beforeend', appInterfaceHTML);

        // =============================================
        // 📚 CONFIGURATION & VARIABLES
        // =============================================
        const libraryData = [
{
                title: "Combat",
                cover: "https://flipbook-pr.github.io/flipbook/Combat.jpg",
                url: "https://flipbook-pr.github.io/flipbook/Combat.pdf" 
            },
            {
                title: "Happiness",
                cover: "https://flipbook-pr.github.io/flipbook/Happiness.jpg",
                url: "https://flipbook-pr.github.io/flipbook/Happiness.pdf"
            },
            {
                title: "Sharpening",
                cover: "https://flipbook-pr.github.io/flipbook/Sharpening.jpg",
                url: "https://flipbook-pr.github.io/flipbook/Sharpening.pdf"
            }
        ];

        let bookElement = null; 
        const zoomLayer = document.getElementById('fbpS-zoom-layer');
        const bookStage = document.getElementById('fbpS-stage');
        const loader = document.getElementById('fbpS-loader');
        const loaderText = document.getElementById('fbpS-loader-text');
        const controls = document.getElementById('fbpS-controls');
        const sidebar = document.getElementById('fbpS-sidebar');
        const thumbContainer = document.getElementById('fbpS-thumb-container');
        const toast = document.getElementById('fbpS-toast');
        const popup = document.getElementById('fbpS-popup');
        const fileUploadInput = document.getElementById('fbpS-file-upload');
        const btnThumbs = document.getElementById('fbpS-btn-thumbs');
        const sidebarCloseBtn = document.getElementById('fbpS-sidebar-close');
        const floatPrev = document.getElementById('fbpS-float-prev');
        const floatNext = document.getElementById('fbpS-float-next');
        const pageInput = document.getElementById('fbpS-page-input');
        const totalPagesSpan = document.getElementById('fbpS-total-pages');
        
        let pageFlip = null;
        let currentZoom = 1; let minZoom = 1; 
        const ZOOM_MID = 1.08; const ZOOM_MAX = 1.8;
        let zoomDirection = 1;
        
        let isDragging = false;
        let startX, startY, translateX = 0, translateY = 0;
        let lastMoveX = 0, lastMoveY = 0;
        let velocityX = 0, velocityY = 0;
        let animationFrameId = null; 
        let clickStartX = 0; let clickStartY = 0;

        let autoPlayInterval = null; let isAutoPlaying = false;
        const STORAGE_KEY = 'fbpS_save_point';
        const flipSound = document.getElementById('fbpS-sound');
        if(flipSound) flipSound.volume = 0.2;

        const RENDER_SCALE = 1.8; 
        const PAGE_WIDTH = 595 * RENDER_SCALE; 
        const PAGE_HEIGHT = 842 * RENDER_SCALE; 
        
        let globalPdfDoc = null; 
        let pageDataMap = [];    

        // --- Initialize Library ---
        function renderLibrary() {
            const container = document.getElementById('fbpS-library-container');
            container.innerHTML = '';
            libraryData.forEach((book) => {
                const card = document.createElement('div');
                card.className = 'fbpS-book-card';
                let coverHTML = `<i class="fas fa-book"></i>`;
                if(book.cover && book.cover.startsWith('http')) {
                    coverHTML = `<img src="${book.cover}" alt="${book.title}" onerror="this.style.display='none';this.parentNode.innerHTML='<i class=\'fas fa-book\'></i>'">`;
                }
                card.innerHTML = `<div class="fbpS-book-cover">${coverHTML}</div><div class="fbpS-book-title">${book.title}</div>`;
                card.addEventListener('click', () => loadBookFromURL(book.url, book.title));
                container.appendChild(card);
            });
        }
        renderLibrary();

        // --- App Logic ---
        function resetApplication() {
            if (pageFlip) { try { pageFlip.destroy(); } catch(e) {} pageFlip = null; }
            zoomLayer.innerHTML = '';
            bookElement = document.createElement('div');
            bookElement.id = 'fbpS-book';
            zoomLayer.appendChild(bookElement);
            thumbContainer.innerHTML = '';
            currentZoom = 1; translateX = 0; translateY = 0; zoomDirection = 1;
            
            globalPdfDoc = null;
            pageDataMap = [];

            updateZoom(); stopAutoPlay();
            sidebar.classList.remove('active'); btnThumbs.classList.remove('active-btn');
            totalPagesSpan.innerText = '0'; pageInput.value = '0';
        }

        function autoResizeBook() {
            if (window.getComputedStyle(popup).display === 'none') return;
            const availableHeight = bookStage.clientHeight;
            const availableWidth = bookStage.clientWidth;
            const baseWidth = PAGE_WIDTH * 2;
            const baseHeight = PAGE_HEIGHT;
            const scaleX = availableWidth / baseWidth;
            const scaleY = availableHeight / baseHeight;
            let scaleToFit = Math.min(scaleX, scaleY);
            scaleToFit = scaleToFit * 0.96; 
            minZoom = scaleToFit; currentZoom = scaleToFit;
            translateX = 0; translateY = 0; zoomDirection = 1; 
            updateZoom();
        }
        window.addEventListener('resize', autoResizeBook);

        // =============================================
        // 🖱️ ZOOM, PAN & SELECTION LOGIC (UPDATED)
        // =============================================
function updateZoom() {
    if (currentZoom <= minZoom) { currentZoom = minZoom; translateX = 0; translateY = 0; zoomDirection = 1; }
    
    let centeringOffset = 0;
    // পেজ ১ হলে একটু সেন্টারে আনার লজিক
    if (pageFlip && pageFlip.getCurrentPageIndex() === 0) centeringOffset = -(PAGE_WIDTH) / 2;
    
    const finalX = translateX + (centeringOffset * currentZoom);
    zoomLayer.style.transform = `translate(${finalX}px, ${translateY}px) scale(${currentZoom})`;
    
    // === কারসার লজিক আপডেট (শুরু) ===
    if (isDragging) { 
        // ড্র্যাগ করার সময় সব জায়গায় গ্র্যাবিং আইকন থাকবে
        bookStage.style.cursor = 'grabbing'; 
        if(bookElement) bookElement.style.cursor = 'grabbing';
    } 
    else {
        // ড্র্যাগ না করলে, ব্যাকগ্রাউন্ড বা ফাঁকা জায়গায় নরমাল কারসার থাকবে
        bookStage.style.cursor = 'default'; 

        // কিন্তু বইয়ের (bookElement) ওপর জুম আইকন দেখাবে
        if (bookElement) {
            if (currentZoom >= ZOOM_MAX - 0.05) bookElement.style.cursor = 'zoom-out';
            else if (currentZoom <= minZoom + 0.05) bookElement.style.cursor = 'zoom-in';
            else bookElement.style.cursor = (zoomDirection === 1) ? 'zoom-in' : 'zoom-out';
        }
    }
    // === কারসার লজিক আপডেট (শেষ) ===
}
        
        bookStage.addEventListener('wheel', (e) => {
            if (e.ctrlKey) return; e.preventDefault();
            const zoomSpeed = 0.15; zoomLayer.classList.remove('no-transition');
            if (e.deltaY < 0) { if (currentZoom < ZOOM_MAX) currentZoom += zoomSpeed; if (currentZoom >= ZOOM_MAX) zoomDirection = -1; } 
            else { if (currentZoom > minZoom) currentZoom -= zoomSpeed; if (currentZoom <= minZoom) zoomDirection = 1; }
            updateZoom();
        }, { passive: false });

        // --- FIX: MOUSE DOWN (Allow Text Selection) ---
// --- MOUSE DOWN (Updated) ---
bookStage.addEventListener('mousedown', (e) => {
    // ১. লিংকে ক্লিক করলে ড্রাগ হবে না
    if (e.target.tagName === 'A' || e.target.closest('.linkAnnotation')) { 
        isDragging = false; 
        return; 
    }

    // ২. লেখার (Text) উপর ক্লিক করলে ড্রাগ হবে না, যাতে টেক্সট সিলেক্ট করা যায়
    if (e.target.closest('.textLayer > span')) {
        isDragging = false;
        return;
    }

    // ৩. ড্রাগ শুরু
    isDragging = true; 
    
    // === নতুন কোড: ড্র্যাগ করার সময় সিলেকশন বন্ধ করা ===
    bookStage.classList.add('fbpS-grabbing-mode'); 
    // ===============================================

    clickStartX = e.clientX; clickStartY = e.clientY;
    startX = e.clientX - translateX; startY = e.clientY - translateY;
    lastMoveX = e.clientX; lastMoveY = e.clientY; velocityX = 0; velocityY = 0;
    zoomLayer.classList.add('no-transition'); 
    
    // কারসার আপডেট
    updateZoom();
});

// --- MOUSE MOVE ---
bookStage.addEventListener('mousemove', (e) => {
    // যদি টেক্সট সিলেক্ট করা থাকে, তবে ড্রাগ হবে না
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) { 
        isDragging = false;
        bookStage.classList.remove('fbpS-grabbing-mode'); // ক্লাস সরিয়ে দিন
        return; 
    }

    if (!isDragging || currentZoom <= minZoom + 0.01) return; 
    e.preventDefault();
    if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(() => {
            velocityX = e.clientX - lastMoveX; velocityY = e.clientY - lastMoveY;
            lastMoveX = e.clientX; lastMoveY = e.clientY;
            translateX = e.clientX - startX; translateY = e.clientY - startY; 
            updateZoom(); animationFrameId = null;
        });
    }
});

// --- MOUSE UP ---
bookStage.addEventListener('mouseup', (e) => {
    isDragging = false; 
    
    // === নতুন কোড: ড্র্যাগ শেষ, সিলেকশন আবার চালু ===
    bookStage.classList.remove('fbpS-grabbing-mode');
    // =============================================

    if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null;
    zoomLayer.classList.remove('no-transition'); 
    
    const moveDist = Math.sqrt(Math.pow(e.clientX - clickStartX, 2) + Math.pow(e.clientY - clickStartY, 2));
    
    if (moveDist < 5) { 
        handleBookClick(e); 
    } else {
        // Inertia Logic (বাকি সব আগের মতোই)
        translateX += velocityX * 12; translateY += velocityY * 12;
        const stageW = bookStage.clientWidth; const stageH = bookStage.clientHeight;
        const bookTotalW = (PAGE_WIDTH * 2) * currentZoom;
        const bookTotalH = (PAGE_HEIGHT) * currentZoom;
        let maxPanX = (bookTotalW - stageW) / 2; let maxPanY = (bookTotalH - stageH) / 2;
        if (maxPanX < 0) maxPanX = 0; if (maxPanY < 0) maxPanY = 0;
        if (translateX > maxPanX) translateX = maxPanX; else if (translateX < -maxPanX) translateX = -maxPanX;
        if (translateY > maxPanY) translateY = maxPanY; else if (translateY < -maxPanY) translateY = -maxPanY;
        updateZoom();
    }
});

// --- MOUSE LEAVE ---
bookStage.addEventListener('mouseleave', () => { 
    isDragging = false; 
    bookStage.classList.remove('fbpS-grabbing-mode'); // ক্লাস সরিয়ে দিন
    zoomLayer.classList.remove('no-transition'); 
    updateZoom(); 
});

function handleBookClick(e) {
    // ১. কন্ট্রোল বা সাইডবারে ক্লিক করলে ইগনোর করুন
    if (e.target.closest('.fbpS-controls') || e.target.closest('.fbpS-sidebar') || e.target.closest('.fbpS-arrow')) return;
    
    // ২. লিংকে ক্লিক করলে ইগনোর করুন
    if (e.target.tagName === 'A' || e.target.closest('.linkAnnotation')) return;
    
    // ৩. টেক্সট সিলেক্ট করা থাকলে ইগনোর করুন
    const selection = window.getSelection();
    if (selection.toString().length > 0) return;

    // === নতুন আপডেট: বইয়ের বাহিরে ক্লিক করলে জুম হবে না ===
    // ক্লিকটি যদি বইয়ের (#fbpS-book) ভেতরে না হয়, তাহলে ফাংশন থামিয়ে দিন
    if (!e.target.closest('#fbpS-book')) return;
    // ===================================================

    // ৪. জুম লজিক (যা ছিল তাই আছে)
    if (Math.abs(currentZoom - minZoom) < 0.1) { currentZoom = ZOOM_MID; zoomDirection = 1; } 
    else if (Math.abs(currentZoom - ZOOM_MAX) < 0.1) { currentZoom = ZOOM_MID; zoomDirection = -1; } 
    else { if (zoomDirection === 1) currentZoom = ZOOM_MAX; else { currentZoom = minZoom; translateX = 0; translateY = 0; zoomDirection = 1; } }
    updateZoom();
}

        document.getElementById('fbpS-btn-zoom-in').addEventListener('click', () => { if (currentZoom < ZOOM_MAX) { currentZoom += 0.25; if (currentZoom > ZOOM_MAX) currentZoom = ZOOM_MAX; if(currentZoom >= ZOOM_MAX) zoomDirection = -1; updateZoom(); } });
        document.getElementById('fbpS-btn-zoom-out').addEventListener('click', () => { if (currentZoom > minZoom) { currentZoom -= 0.25; if (currentZoom < minZoom) currentZoom = minZoom; if(currentZoom <= minZoom) zoomDirection = 1; updateZoom(); } });

        // --- CORE PAGEFLIP ---
        function initFlipBook() {
            pageFlip = new St.PageFlip(bookElement, {
                width: PAGE_WIDTH, height: PAGE_HEIGHT,
                size: 'fixed', minWidth: 200, maxWidth: 8000, minHeight: 300, maxHeight: 8000,
                showCover: true, usePortrait: false, flippingTime: 800, 
                useMouseEvents: false, maxShadowOpacity: 0.3
            });
            
            pageFlip.on('flip', (e) => { 
                updatePageInfo(); 
                playSound(); 
                checkBookmarkIcon(); 
                updateZoom();
                manageMemoryAndRender(e.data);
            });
            
            setTimeout(() => {
                autoResizeBook();
                manageMemoryAndRender(0); 
            }, 100);
        }

        function playSound() { if(flipSound){ flipSound.currentTime = 0; flipSound.play().catch(() => {}); } }
        function updatePageInfo() { if(pageFlip) pageInput.value = (pageFlip.getCurrentPageIndex() + 1); }
        
        btnThumbs.addEventListener('click', () => { sidebar.classList.toggle('active'); btnThumbs.classList.toggle('active-btn'); });
        sidebarCloseBtn.addEventListener('click', () => { sidebar.classList.remove('active'); btnThumbs.classList.remove('active-btn'); });
        
        const btnAutoPlay = document.getElementById('fbpS-btn-autoplay');
        btnAutoPlay.addEventListener('click', () => { if (isAutoPlaying) stopAutoPlay(); else startAutoPlay(); });
        function startAutoPlay() { isAutoPlaying = true; btnAutoPlay.innerHTML = '<i class="fas fa-pause"></i>'; btnAutoPlay.classList.add('active-btn'); autoPlayInterval = setInterval(() => { if (pageFlip.getCurrentPageIndex() < pageFlip.getPageCount() - 1) pageFlip.flipNext(); else stopAutoPlay(); }, 3000); }
        function stopAutoPlay() { isAutoPlaying = false; btnAutoPlay.innerHTML = '<i class="fas fa-play"></i>'; btnAutoPlay.classList.remove('active-btn'); clearInterval(autoPlayInterval); }
        
        floatNext.addEventListener('click', () => { if(pageFlip) pageFlip.flipNext(); stopAutoPlay(); });
        floatPrev.addEventListener('click', () => { if(pageFlip) pageFlip.flipPrev(); stopAutoPlay(); });

        const btnBookmark = document.getElementById('fbpS-btn-bookmark');
        const btnLoadMark = document.getElementById('fbpS-btn-load-mark');
        function checkSavedBookmark() { const saved = localStorage.getItem(STORAGE_KEY); if(saved) { btnLoadMark.style.display = 'flex'; return parseInt(saved); } return null; }
        function checkBookmarkIcon() { const saved = checkSavedBookmark(); const current = pageFlip.getCurrentPageIndex(); if (saved !== null && Math.abs(saved - current) <= 1) btnBookmark.innerHTML = '<i class="fas fa-bookmark"></i>'; else btnBookmark.innerHTML = '<i class="far fa-bookmark"></i>'; }
        btnBookmark.addEventListener('click', () => { localStorage.setItem(STORAGE_KEY, pageFlip.getCurrentPageIndex()); showToast('Bookmark saved!'); checkBookmarkIcon(); btnLoadMark.style.display = 'flex'; });
        btnLoadMark.addEventListener('click', () => { const saved = checkSavedBookmark(); if (saved !== null) { pageFlip.flip(saved); showToast('Bookmark loaded.'); } });
        function showToast(msg) { toast.innerText = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2000); }
        
        document.getElementById('fbpS-btn-close').addEventListener('click', () => {
            resetApplication();
            popup.classList.remove('active'); 
            setTimeout(() => { popup.style.display = 'none'; }, 500);
            controls.classList.remove('active'); sidebar.classList.remove('active');
            fileUploadInput.value = '';
        });

        // --- File Upload Logic ---
        fileUploadInput.addEventListener('change', async function(e) {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            resetApplication();
            popup.style.display = 'flex'; setTimeout(() => { popup.classList.add('active'); }, 10);
            loader.style.display = 'flex';
            const firstFile = files[0];
            try {
                if (firstFile.type === 'application/pdf') {
                    const arrayBuffer = await readFileAsArrayBuffer(firstFile);
                    await renderPDFBytes(arrayBuffer);
                }
                else if (firstFile.type.startsWith('image/')) await processImages(files);
                else { alert('PDF or Image required.'); loader.style.display = 'none'; popup.style.display = 'none'; }
            } catch (error) {
                console.error("Load Error:", error); alert("Error loading file."); resetApplication(); loader.style.display = 'none'; popup.style.display = 'none';
            }
        });

        async function loadBookFromURL(url, title) {
            resetApplication();
            popup.style.display = 'flex'; setTimeout(() => { popup.classList.add('active'); }, 10);
            loader.style.display = 'flex';
            loaderText.innerText = `Downloading: ${title}...`;
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error("Fetch failed");
                const arrayBuffer = await response.arrayBuffer();
                await renderPDFBytes(arrayBuffer);
            } catch (err) {
                console.error(err); alert("Network error. Cannot load book."); 
                loader.style.display = 'none'; popup.classList.remove('active');
            }
        }

        function createInfoCover() {
            const div = document.createElement('div');
            div.className = 'fbpS-page fbpS-page-cover ';
            div.setAttribute('data-density', ''); 
            div.style.cssText = `width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT}px; background: linear-gradient(135deg, #1e272e 0%, #000000 100%); overflow: hidden;`;
            div.innerHTML = `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; width: 90%; color: #ccc;"><i class="fas fa-book-reader" style="font-size: 100px; margin-bottom: 25px;"></i><h2 style="font-family: 'Poppins'; font-size: 30px; margin: 0;">FlipBook Pro</h2></div>`;
            return div;
        }

        async function renderPDFBytes(arrayBuffer) {
            try {
                const typedarray = new Uint8Array(arrayBuffer);
                globalPdfDoc = await pdfjsLib.getDocument(typedarray).promise;
                
                loaderText.innerText = `Analyzing ${globalPdfDoc.numPages} pages...`;
                
                let createdPagesCount = 0;
                pageDataMap = []; 

                const firstPage = await globalPdfDoc.getPage(1);
                const firstVp = firstPage.getViewport({ scale: 1 });
                if (firstVp.width > firstVp.height) {
                    bookElement.appendChild(createInfoCover());
                    pageDataMap.push({ isRendered: true, type: 'cover' }); 
                    createdPagesCount++;
                }

                for (let i = 1; i <= globalPdfDoc.numPages; i++) {
                    const page = await globalPdfDoc.getPage(i);
                    const viewport = page.getViewport({ scale: 1 });
                    const isLandscape = viewport.width > viewport.height;
                    
                    if (isLandscape) {
                        const p1 = createPlaceholder(createdPagesCount);
                        bookElement.appendChild(p1);
                        pageDataMap.push({ 
                            index: createdPagesCount, pdfIndex: i, side: 'left', isSplit: true, 
                            element: p1, isRendered: false 
                        });
                        createdPagesCount++;

                        const p2 = createPlaceholder(createdPagesCount);
                        bookElement.appendChild(p2);
                        pageDataMap.push({ 
                            index: createdPagesCount, pdfIndex: i, side: 'right', isSplit: true, 
                            element: p2, isRendered: false 
                        });
                        createdPagesCount++;
                    } else {
                        const p = createPlaceholder(createdPagesCount);
                        bookElement.appendChild(p);
                        pageDataMap.push({ 
                            index: createdPagesCount, pdfIndex: i, side: 'full', isSplit: false, 
                            element: p, isRendered: false 
                        });
                        createdPagesCount++;
                    }
                }

                totalPagesSpan.innerText = createdPagesCount;
                finishLoading();
                generateThumbnails(globalPdfDoc);

            } catch (err) { console.error(err); alert("PDF Error."); resetApplication(); }
        }

        function createPlaceholder(index) {
            const div = document.createElement('div');
            div.className = 'fbpS-page';
            div.setAttribute('data-density', ''); //  PAGES
            div.id = `fbpS-page-${index}`;
            div.innerHTML = `
                <div class="page-loader" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#444;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 30px;"></i>
                </div>
            `;
            return div;
        }

        // --- AGGRESSIVE PRE-LOADING LOGIC ---
        async function manageMemoryAndRender(currentIndex) {
            if(!globalPdfDoc && !pageDataMap.length) return;

            // Load 3 pages ahead, 2 pages behind
            const range = 3; 
            const startIndex = Math.max(0, currentIndex - range);
            const endIndex = Math.min(pageDataMap.length - 1, currentIndex + range);

            // 1. UNLOAD
            pageDataMap.forEach((data) => {
                if (data.type === 'cover') return;
                if ((data.index < startIndex || data.index > endIndex) && data.isRendered) {
                    unloadPage(data);
                }
            });

            // 2. QUEUE
            const loadQueue = [];
            
            loadQueue.push(currentIndex);
            const currentData = pageDataMap[currentIndex];
            if(currentData && currentData.isSplit) {
                if(currentData.side === 'left' && currentIndex + 1 <= endIndex) loadQueue.push(currentIndex + 1);
                if(currentData.side === 'right' && currentIndex - 1 >= startIndex) loadQueue.push(currentIndex - 1);
            }

            if(currentIndex + 1 <= endIndex && !loadQueue.includes(currentIndex + 1)) loadQueue.push(currentIndex + 1);
            if(currentIndex + 2 <= endIndex && !loadQueue.includes(currentIndex + 2)) loadQueue.push(currentIndex + 2);
            if(currentIndex + 3 <= endIndex && !loadQueue.includes(currentIndex + 3)) loadQueue.push(currentIndex + 3);

            if(currentIndex - 1 >= startIndex && !loadQueue.includes(currentIndex - 1)) loadQueue.push(currentIndex - 1);
            if(currentIndex - 2 >= startIndex && !loadQueue.includes(currentIndex - 2)) loadQueue.push(currentIndex - 2);

            for (let i of loadQueue) {
                const data = pageDataMap[i];
                if (data && !data.isRendered && data.type !== 'cover') {
                    await renderSinglePageHighRes(data);
                    await new Promise(r => setTimeout(r, 20));
                }
            }
        }

        function unloadPage(data) {
            data.element.innerHTML = `
                <div class="page-loader" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#444;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 30px;"></i>
                </div>
            `;
            data.isRendered = false;
        }

        async function renderSinglePageHighRes(data) {
            if (data.isRendered || !globalPdfDoc) return;
            data.isRendered = true; 

            try {
                const page = await globalPdfDoc.getPage(data.pdfIndex);
                
                const canvas = document.createElement('canvas');
                canvas.width = PAGE_WIDTH; 
                canvas.height = PAGE_HEIGHT;
                
                let viewport;

                if (data.isSplit) {
                    const unscaledVp = page.getViewport({ scale: 1 });
                    const scale = PAGE_HEIGHT / unscaledVp.height;
                    viewport = page.getViewport({ scale: scale });
                    
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = viewport.width; tempCanvas.height = viewport.height;
                    
                    await page.render({ canvasContext: tempCanvas.getContext('2d'), viewport }).promise;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
                    
                    const splitW = viewport.width / 2;
                    const srcX = (data.side === 'left') ? 0 : splitW;
                    
                    ctx.drawImage(tempCanvas, srcX, 0, splitW, viewport.height, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
                    tempCanvas.width = 0; tempCanvas.height = 0; 

                    let textOffsetLeft = 0;
                    if (data.side === 'right') textOffsetLeft = -PAGE_WIDTH;
                    renderTextAndLinks(page, viewport, data.element, textOffsetLeft, 0);

                } else {
                    const unscaledVp = page.getViewport({ scale: 1 });
                    const scale = Math.min(PAGE_WIDTH / unscaledVp.width, PAGE_HEIGHT / unscaledVp.height);
                    viewport = page.getViewport({ scale: scale });

                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
                    const drawX = (PAGE_WIDTH - viewport.width) / 2;
                    const drawY = (PAGE_HEIGHT - viewport.height) / 2;
                    
                    ctx.translate(drawX, drawY);
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    ctx.translate(-drawX, -drawY);
                    
                    renderTextAndLinks(page, viewport, data.element, drawX, drawY);
                }

                // Remove loader, add Canvas and Text
                // Note: renderTextAndLinks appended to element already
                const oldContent = data.element.querySelectorAll('.page-loader');
                oldContent.forEach(el => el.remove());
                
                // Prepend canvas so it stays behind text
                if (data.element.firstChild) {
                    data.element.insertBefore(canvas, data.element.firstChild);
                } else {
                    data.element.appendChild(canvas);
                }

            } catch (e) {
                console.error("Render Error Page " + data.index, e);
                data.isRendered = false; 
            }
        }

async function generateThumbnails(pdf) {
            const container = document.getElementById('fbpS-thumb-container');
            // পিডিএফ না হলে আগের থাম্বনেইলগুলো ক্লিয়ার করে নেওয়া ভালো
            if(!pdf) container.innerHTML = '';

            for (let i = 0; i < pageDataMap.length; i++) {
                const data = pageDataMap[i];
                if (data.type === 'cover') continue;
                
                // ল্যান্ডস্কেপ ইমেজের ক্ষেত্রে রাইট সাইড স্কিপ করা
                if (data.side === 'right') continue; 
                
                createThumbnailPlaceholder(data.index, data.pdfIndex);
                
                // ব্রাউজারকে শ্বাস নেওয়ার সময় দেওয়া
                await new Promise(r => setTimeout(r, 50));
            }
            lazyLoadThumbnails();
        }

        function createThumbnailPlaceholder(appPageIndex, pdfPageIndex) {
            const thumbDiv = document.createElement('div'); 
            thumbDiv.className = 'fbpS-thumb-item';
            thumbDiv.id = `thumb-item-${appPageIndex}`;
            thumbDiv.innerHTML = `
                <div style="width:100%; height:180px; background:#333; display:flex; align-items:center; justify-content:center;">
                    <i class="fas fa-image" style="color:#555;"></i>
                </div>
                <div class="fbpS-thumb-label">Page ${appPageIndex+1}</div>
            `;
            thumbDiv.onclick = () => { if(pageFlip) pageFlip.flip(appPageIndex); };
            thumbContainer.appendChild(thumbDiv);
        }

async function lazyLoadThumbnails() {
            const thumbs = document.querySelectorAll('.fbpS-thumb-item');
            
            for (let i = 0; i < thumbs.length; i++) {
                const item = thumbs[i];
                if (item.querySelector('canvas')) continue;

                const appIndex = parseInt(item.id.replace('thumb-item-', ''));
                const data = pageDataMap.find(d => d.index === appIndex);
                if (!data) continue;

                const imgContainer = item.querySelector('div');

                // PDF Logic
                if (globalPdfDoc && data.pdfIndex) {
                    try {
                        const page = await globalPdfDoc.getPage(data.pdfIndex);
                        const vp = page.getViewport({ scale: 0.2 }); 
                        const cvs = document.createElement('canvas');
                        cvs.width = vp.width; cvs.height = vp.height;
                        await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
                        
                        imgContainer.innerHTML = '';
                        // === ফিক্স: ফিক্সড হাইট সরিয়ে অটো করা হলো ===
                        imgContainer.style.height = 'auto';
                        imgContainer.style.background = 'transparent';
                        // ==========================================
                        
                        cvs.style.width = '100%'; cvs.style.height = 'auto';
                        imgContainer.appendChild(cvs);
                    } catch(e) {}
                }
                // Image Logic (Split & Spacing Fixed)
                else if (data.type === 'image' && data.imgObj) {
                    const cvs = document.createElement('canvas');
                    
                    let sw, sh, sx;
                    if (data.isSplit) {
                        sw = data.imgObj.width / 2;
                        sh = data.imgObj.height;
                        sx = (data.side === 'right') ? sw : 0;
                    } else {
                        sw = data.imgObj.width;
                        sh = data.imgObj.height;
                        sx = 0;
                    }

                    const targetWidth = 200; 
                    cvs.width = targetWidth;
                    // রেশিও অনুযায়ী হাইট সেট করা
                    const ratio = sh / sw; 
                    cvs.height = targetWidth * ratio;

                    const ctx = cvs.getContext('2d');
                    ctx.drawImage(data.imgObj, sx, 0, sw, sh, 0, 0, cvs.width, cvs.height);

                    imgContainer.innerHTML = '';
                    
                    // === ফিক্স: ফিক্সড হাইট সরিয়ে অটো করা হলো ===
                    imgContainer.style.height = 'auto';
                    imgContainer.style.display = 'block'; 
                    imgContainer.style.background = 'transparent';
                    // ==========================================

                    cvs.style.width = '100%'; cvs.style.height = 'auto';
                    imgContainer.appendChild(cvs);
                }

                await new Promise(r => setTimeout(r, 100)); 
            }
        }

// =============================================
// 🔤 RENDER TEXT & LINKS (UPDATED FIX)
// =============================================
function renderTextAndLinks(page, viewport, container, offsetX, offsetY) {
    // টেক্সট লেয়ার ডুপ্লিকেট যাতে না হয়
    if (container.querySelector('.textLayer')) return;

    // ১. টেক্সট লেয়ার তৈরি
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.width = `${viewport.width}px`; 
    textLayerDiv.style.height = `${viewport.height}px`;
    textLayerDiv.style.left = `${offsetX}px`; 
    textLayerDiv.style.top = `${offsetY}px`;
    
    container.appendChild(textLayerDiv);
    
    // টেক্সট রেন্ডার করা
    page.getTextContent().then(textContent => {
        pdfjsLib.renderTextLayer({ 
            textContent: textContent, 
            container: textLayerDiv, 
            viewport: viewport, 
            textDivs: [] 
        });
    });
    
    // ২. লিংক/এনোটেশন লেয়ার তৈরি
    page.getAnnotations().then(annotations => {
        if (annotations.length === 0) return;

        const layer = document.createElement('div');
        layer.className = 'annotationLayer';
        layer.style.width = `${viewport.width}px`; 
        layer.style.height = `${viewport.height}px`;
        layer.style.left = `${offsetX}px`; 
        layer.style.top = `${offsetY}px`;
        container.appendChild(layer);

        annotations.forEach(annotation => {
            // শুধুমাত্র লিংক এনোটেশন প্রসেস করবো
            if (annotation.subtype === 'Link' && annotation.rect) {
                // PDF কো-অর্ডিনেট থেকে ভিউপোর্ট রেকট্যাঙ্গেলে কনভার্ট করা
                const rect = viewport.convertToViewportRectangle(annotation.rect);
                
                // সঠিক পজিশন বের করা (x, y, width, height)
                // pdf.js এর ভার্সন অনুযায়ী কো-অর্ডিনেট অ্যারে ভিন্ন হতে পারে, তাই min/abs ব্যবহার করা নিরাপদ
                const x = Math.min(rect[0], rect[2]);
                const y = Math.min(rect[1], rect[3]);
                const w = Math.abs(rect[2] - rect[0]);
                const h = Math.abs(rect[3] - rect[1]);

                const section = document.createElement('section');
                section.className = 'linkAnnotation';
                section.style.left = x + 'px'; 
                section.style.top = y + 'px';
                section.style.width = w + 'px'; 
                section.style.height = h + 'px';

                const a = document.createElement('a');
                
                // যদি এক্সটার্নাল লিংক (URL) হয়
                if (annotation.url) { 
                    a.href = annotation.url; 
                    a.target = '_blank';
                    a.title = annotation.url; // মাউস নিলে লিংক দেখাবে

                    // *** গুরুত্বপূর্ণ ফিক্স: ইভেন্ট বাবলিং বন্ধ করা ***
                    // এটি ফ্লিপবুকের ইভেন্ট লিসেনারকে বাইপাস করবে
                    a.addEventListener('click', (e) => {
                        e.stopPropagation(); // প্যারেন্ট এলিমেন্টে ক্লিক পৌঁছাবে না
                    });
                    
                    // টাচ ডিভাইসের জন্য
                    a.addEventListener('touchstart', (e) => {
                        e.stopPropagation();
                    }, { passive: true });
                }
                
                section.appendChild(a);
                layer.appendChild(section);
            }
        });
    });
}

        // --- Image Handling ---
async function processImages(files) {
            // ফাইল নাম অনুযায়ী সর্ট করা
            files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            
            let createdPagesCount = 0;
            pageDataMap = []; 
            globalPdfDoc = null; 

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file.type.startsWith('image/')) continue;
                
                const imgData = await readFileAsDataURL(file);
                const img = await loadImage(imgData);
                
                // === ফিক্স: প্রথম ইমেজ যদি ল্যান্ডস্কেপ হয়, তবে আগে একটি কভার যোগ করুন ===
                if (i === 0 && img.width > img.height) {
                    bookElement.appendChild(createInfoCover());
                    pageDataMap.push({ isRendered: true, type: 'cover' }); 
                    createdPagesCount++;
                }
                // =====================================================================

                // লজিক: যদি ইমেজের প্রস্থ উচ্চতার চেয়ে বেশি হয় (ল্যান্ডস্কেপ)
                if (img.width > img.height) {
                    // ১. বাম পাশের পাতা
                    const p1 = createPlaceholder(createdPagesCount);
                    bookElement.appendChild(p1);
                    pageDataMap.push({
                       index: createdPagesCount, type: 'image', imgObj: img, side: 'left', isSplit: true,
                       element: p1, isRendered: false
                    });
                    createdPagesCount++;

                    // ২. ডান পাশের পাতা
                    const p2 = createPlaceholder(createdPagesCount);
                    bookElement.appendChild(p2);
                    pageDataMap.push({
                       index: createdPagesCount, type: 'image', imgObj: img, side: 'right', isSplit: true,
                       element: p2, isRendered: false
                    });
                    createdPagesCount++;
                } else {
                    // পোর্ট্রেট ইমেজ
                    const p = createPlaceholder(createdPagesCount);
                    bookElement.appendChild(p);
                    pageDataMap.push({
                        index: createdPagesCount, type: 'image', imgObj: img, side: 'full', isSplit: false,
                        element: p, isRendered: false
                    });
                    createdPagesCount++;
                }
            }
            
            totalPagesSpan.innerText = createdPagesCount;
            generateThumbnails(null);
            finishLoading();
            manageImageMemory(0);
        }
        
function manageImageMemory(currentIndex) {
            // === আপডেট: রেঞ্জ বাড়িয়ে ৫ করা হলো (আগে ২ ছিল) ===
            // এর ফলে বর্তমান পেজের আগে ও পরের ৫টি করে পেজ মেমোরিতে রেডি থাকবে।
            // পেজ উল্টানোর আগেই ইমেজ তৈরি থাকায় আর ফাঁকা দেখাবে না।
            const range = 3; 

            const startIndex = Math.max(0, currentIndex - range);
            const endIndex = Math.min(pageDataMap.length - 1, currentIndex + range);

            // ১. মেমোরি ক্লিনআপ (Unload)
            // রেঞ্জের বাইরের পেজগুলো মুছে ফেলা হবে যাতে ব্রাউজার স্লো না হয়
            pageDataMap.forEach(d => {
                if(d.type !== 'image') return;
                
                if((d.index < startIndex || d.index > endIndex) && d.isRendered) {
                    d.element.innerHTML = ''; // ক্যানভাস রিমুভ করে মেমোরি খালি করা
                    d.isRendered = false;
                }
            });

            // ২. রেন্ডারিং (Render)
            // লুপ চালিয়ে রেঞ্জের ভেতরের সব ইমেজ ক্যানভাসে এঁকে রাখা হবে
            for(let i = startIndex; i <= endIndex; i++) {
                const d = pageDataMap[i];
                if(d && !d.isRendered && d.type === 'image') {
                   renderImageToCanvas(d);
                }
            }
        }

function renderImageToCanvas(d) {
             if (!d.imgObj) return;
             d.isRendered = true;
             
             const cvs = document.createElement('canvas');
             cvs.width = PAGE_WIDTH; 
             cvs.height = PAGE_HEIGHT;
             const ctx = cvs.getContext('2d');
             
             // ব্যাকগ্রাউন্ড সাদা
             ctx.fillStyle = "#fff"; 
             ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

             if (d.isSplit) {
                 // === ল্যান্ডস্কেপ ইমেজ কাটা এবং পেজে ফিট করা ===
                 const sourceHalfWidth = d.imgObj.width / 2;
                 const sourceHeight = d.imgObj.height;
                 
                 // বাম পাশ হলে ০, ডান পাশ হলে অর্ধেক থেকে শুরু
                 const sourceX = (d.side === 'left') ? 0 : sourceHalfWidth;

                 // এখানে ইমেজটিকে টেনে (Stretch) পুরো পেজে বসানো হচ্ছে
                 // যাতে মাঝখানে কোনো ফাঁকা না থাকে।
                 ctx.drawImage(
                     d.imgObj, 
                     sourceX, 0, sourceHalfWidth, sourceHeight, // সোর্স (ইমেজের অর্ধেক)
                     0, 0, PAGE_WIDTH, PAGE_HEIGHT              // ডেস্টিনেশন (পুরো পেজ)
                 );
                 
             } else {
                 // === পোর্ট্রেট ইমেজ (নরমাল) ===
                 const sw = d.imgObj.width;
                 const sh = d.imgObj.height;
                 
                 // অ্যাসপেক্ট রেশিও ঠিক রেখে ফিট করা
                 const scale = Math.min(PAGE_WIDTH / sw, PAGE_HEIGHT / sh);
                 const dw = sw * scale;
                 const dh = sh * scale;
                 
                 const dx = (PAGE_WIDTH - dw) / 2;
                 const dy = (PAGE_HEIGHT - dh) / 2;

                 ctx.drawImage(d.imgObj, 0, 0, sw, sh, dx, dy, dw, dh);
             }
             
             d.element.innerHTML = '';
             d.element.appendChild(cvs);
        }
        
        function finishLoading() {
            initFlipBook(); 
            const pages = document.querySelectorAll('.fbpS-page');
            
            // ENSURE ALL PAGES ARE 
            pages.forEach(p => p.setAttribute('data-density', ''));

            pageFlip.loadFromHTML(pages);
            
            if(!globalPdfDoc) {
                pageFlip.on('flip', (e) => {
                     updatePageInfo(); playSound(); updateZoom();
                     manageImageMemory(e.data);
                });
            }

            checkSavedBookmark(); 
            loader.style.display = 'none'; 
            controls.classList.add('active'); 
            setTimeout(() => { updateZoom(); updatePageInfo(); }, 100);
        }
        
        function readFileAsDataURL(file) { return new Promise((r, j) => { const x = new FileReader(); x.onload = () => r(x.result); x.onerror = j; x.readAsDataURL(file); }); }
        function readFileAsArrayBuffer(file) { return new Promise((r, j) => { const x = new FileReader(); x.onload = () => r(x.result); x.onerror = j; x.readAsArrayBuffer(file); }); }
        function loadImage(src) { return new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = src; }); }
        
        document.getElementById('fbpS-btn-fullscreen').addEventListener('click', () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); });
		
		
		
	})();	