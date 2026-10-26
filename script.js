/**
 * My Note Book - Main Script
 * Vanilla JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    // State Management
    let books = JSON.parse(localStorage.getItem('my_notebooks')) || [];
    let currentBook = null;
    let currentPageIndex = 0;
    let autoSaveTimeout = null;

    // DOM Elements
    const libraryPage = document.getElementById('library-page');
    const bookViewerPage = document.getElementById('book-viewer-page');
    const booksGrid = document.getElementById('books-grid');
    const createModal = document.getElementById('create-modal');
    const openCreateModalBtn = document.getElementById('open-create-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const createBookForm = document.getElementById('create-book-form');
    const themeToggle = document.getElementById('theme-toggle');
    const searchInput = document.getElementById('search-input');
    
    // Book Viewer Elements
    const bookContainer = document.getElementById('book');
    const viewingBookTitle = document.getElementById('viewing-book-title');
    const closeBookBtn = document.getElementById('close-book');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const currentPageNumDisplay = document.getElementById('current-page-num');
    const totalPagesNumDisplay = document.getElementById('total-pages-num');
    const deleteBookBtn = document.getElementById('delete-book-btn');
    const addPageBtn = document.getElementById('add-page-btn');

    // Audio Elements
    const flipSound = document.getElementById('flip-sound');
    const clickSound = document.getElementById('click-sound');

    // Initialize
    setTimeout(() => {
        const loader = document.getElementById('loader');
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 500);
    }, 1500);

    renderBooks();

    // --- Library Logic ---

    function renderBooks(filter = '') {
        booksGrid.innerHTML = '';
        const filteredBooks = books.filter(book => 
            book.title.toLowerCase().includes(filter.toLowerCase())
        );

        if (filteredBooks.length === 0) {
            booksGrid.innerHTML = `
                <div class="empty-state">
                    <p>لا يوجد كتب حالياً. ابدأ بإنشاء كتابك الأول!</p>
                </div>
            `;
            return;
        }

        filteredBooks.forEach(book => {
            const card = document.createElement('div');
            card.className = 'book-card';
            card.innerHTML = `
                <div class="book-card-inner">
                    <div class="book-cover" style="background-color: ${book.color}">
                        <div class="book-card-actions">
                            <button class="card-action-btn edit" title="تعديل العنوان" onclick="event.stopPropagation(); app.editBook('${book.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="card-action-btn delete" title="حذف الكتاب" onclick="event.stopPropagation(); app.deleteBook('${book.id}')">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                        <h3 class="book-card-title">${book.title}</h3>
                        <div class="book-card-info">
                            <span class="book-card-date">${new Date(book.createdAt).toLocaleDateString('ar-EG')}</span>
                            <span class="book-card-pages">${book.pages.length} صفحة</span>
                        </div>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => openBook(book.id));
            booksGrid.appendChild(card);
        });
    }

    // --- Modal Logic ---

    openCreateModalBtn.addEventListener('click', () => {
        createModal.classList.add('active');
        playClickSound();
    });

    closeModalBtn.addEventListener('click', () => {
        createModal.classList.remove('active');
    });

    createBookForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('book-title').value;
        const color = document.querySelector('input[name="cover-color"]:checked').value;

        const newBook = {
            id: Date.now().toString(),
            title: title,
            color: color,
            createdAt: new Date().toISOString(),
            pages: [
                { id: 'toc', content: '<h2>جدول المحتويات</h2><ul class="toc-list"></ul>', type: 'toc' },
                { id: 'page-1', content: '<p>ابدأ الكتابة هنا...</p>', type: 'content' }
            ]
        };

        books.unshift(newBook);
        saveToLocalStorage();
        renderBooks();
        createModal.classList.remove('active');
        createBookForm.reset();
        openBook(newBook.id);
    });

    // --- Book Viewer Logic ---

    function openBook(bookId) {
        currentBook = books.find(b => b.id === bookId);
        if (!currentBook) return;

        currentPageIndex = 0;
        viewingBookTitle.textContent = currentBook.title;
        
        libraryPage.classList.remove('active');
        bookViewerPage.classList.add('active');
        
        renderBookPages();
        updateTOC();
        playClickSound();
    }

    function addBlankPage() {
        const newPage = {
            id: 'page-' + Date.now(),
            content: '<p>...</p>',
            type: 'content'
        };
        currentBook.pages.push(newPage);
        saveToLocalStorage();
        
        // Re-render pages to ensure Z-indices and DOM indices are perfectly synced with the array
        renderBookPages();
        updateTOC();
    }

    function createPageElement(page, index) {
        const pageEl = document.createElement('div');
        pageEl.className = 'page-element';
        pageEl.style.zIndex = currentBook.pages.length - index;
        
        // Front of page
        const front = document.createElement('div');
        front.className = 'page-front';
        
        let deleteBtnHtml = '';
        if (page.type === 'content') {
            deleteBtnHtml = `
                <button class="delete-page-btn" title="حذف هذه الصفحة" onclick="event.stopPropagation(); app.deletePage(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
        }

        front.innerHTML = `
            ${deleteBtnHtml}
            <div class="page-content" contenteditable="true" data-index="${index}">
                ${page.content}
            </div>
            <div class="page-num">${index + 1}</div>
        `;

        // Back of page (for the flip effect)
        const back = document.createElement('div');
        back.className = 'page-back';
        back.innerHTML = `<div class="page-num">${index + 1}</div>`;

        pageEl.appendChild(front);
        pageEl.appendChild(back);

        // Event listener for auto-save
        const contentArea = front.querySelector('.page-content');
        contentArea.addEventListener('input', (e) => {
            handleContentChange(index, e.target.innerHTML);
        });

        return pageEl;
    }

    function renderBookPages() {
        bookContainer.innerHTML = '';
        
        // Add Cover Page
        const coverEl = document.createElement('div');
        coverEl.className = 'page-element cover-page';
        coverEl.style.zIndex = currentBook.pages.length + 1;
        
        const coverFront = document.createElement('div');
        coverFront.className = 'page-front book-cover';
        coverFront.style.backgroundColor = currentBook.color;
        coverFront.innerHTML = `
            <h2 class="book-card-title" style="font-size: 2.5rem; text-align: center; margin-top: 50px;">${currentBook.title}</h2>
            <div style="text-align: center; margin-bottom: 50px;">
                <i class="fas fa-book-open" style="font-size: 5rem; opacity: 0.5;"></i>
            </div>
        `;
        
        const coverBack = document.createElement('div');
        coverBack.className = 'page-back';
        
        coverEl.appendChild(coverFront);
        coverEl.appendChild(coverBack);
        bookContainer.appendChild(coverEl);
        
        // Render other pages in order from the array
        currentBook.pages.forEach((page, index) => {
            const pageEl = createPageElement(page, index);
            bookContainer.appendChild(pageEl);
        });

        // Ensure current page index is valid after rendering
        if (currentPageIndex >= bookContainer.children.length) {
            currentPageIndex = bookContainer.children.length - 1;
        }

        // Apply "flipped" class to all pages before the current index
        for (let i = 0; i < currentPageIndex; i++) {
            bookContainer.children[i].classList.add('flipped');
        }

        updatePaginationUI();
    }

    function handleContentChange(index, content) {
        currentBook.pages[index].content = content;
        
        // Check for overflow
        const contentArea = document.querySelector(`.page-content[data-index="${index}"]`);
        if (contentArea && contentArea.scrollHeight > contentArea.clientHeight) {
            handlePagination(index, contentArea);
        }

        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            saveToLocalStorage();
            if (currentBook.pages[index].type !== 'toc') {
                updateTOC();
            }
        }, 1000);
    }

    function handlePagination(index, contentArea) {
        const nextPageIndex = index + 1;
        
        if (nextPageIndex >= currentBook.pages.length) {
            // Add a new blank page to the array
            const newPage = {
                id: 'page-' + Date.now(),
                content: '',
                type: 'content'
            };
            currentBook.pages.push(newPage);
            saveToLocalStorage();
            
            // Re-render to create the new DOM elements
            renderBookPages();
            
            // Wait for DOM update then move content
            setTimeout(() => {
                moveOverflowingContent(index, nextPageIndex);
            }, 50);
            return;
        }

        moveOverflowingContent(index, nextPageIndex);
    }

    function moveOverflowingContent(index, nextPageIndex) {
        const currentArea = document.querySelector(`.page-content[data-index="${index}"]`);
        const nextArea = document.querySelector(`.page-content[data-index="${nextPageIndex}"]`);
        
        if (!currentArea || !nextArea) return;

        while (currentArea.scrollHeight > currentArea.clientHeight && currentArea.lastChild) {
            const lastChild = currentArea.lastChild;
            if (nextArea.firstChild) {
                nextArea.insertBefore(lastChild, nextArea.firstChild);
            } else {
                nextArea.appendChild(lastChild);
            }
        }

        // Update state from DOM
        currentBook.pages[index].content = currentArea.innerHTML;
        currentBook.pages[nextPageIndex].content = nextArea.innerHTML;
        
        saveToLocalStorage();
        updatePaginationUI();
    }

    function updateTOC() {
        const tocPage = currentBook.pages.find(p => p.type === 'toc');
        if (!tocPage) return;

        let tocHtml = '<h2>جدول المحتويات</h2><ul class="toc-list">';
        
        currentBook.pages.forEach((page, index) => {
            if (page.type === 'toc') return;
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = page.content;
            const headers = tempDiv.querySelectorAll('h2, h3');
            
            headers.forEach(header => {
                tocHtml += `
                    <li class="toc-item" data-page="${index}">
                        <span>${header.textContent}</span>
                        <span>${index + 1}</span>
                    </li>
                `;
            });
        });

        tocHtml += '</ul>';
        tocPage.content = tocHtml;
        
        const tocContentEl = document.querySelector(`.page-content[data-index="0"]`);
        if (tocContentEl) {
            tocContentEl.innerHTML = tocHtml;
            tocContentEl.querySelectorAll('.toc-item').forEach(item => {
                item.addEventListener('click', () => {
                    const pageTarget = parseInt(item.dataset.page) + 1;
                    goToPage(pageTarget);
                });
            });
        }
    }

    function goToPage(index) {
        while (currentPageIndex < index) {
            nextPage();
        }
        while (currentPageIndex > index) {
            prevPage();
        }
    }

    function nextPage() {
        if (currentPageIndex < currentBook.pages.length) {
            const pageEl = bookContainer.children[currentPageIndex];
            pageEl.classList.add('flipped');
            currentPageIndex++;
            updatePaginationUI();
            playFlipSound();
        }
    }

    function prevPage() {
        if (currentPageIndex > 0) {
            currentPageIndex--;
            const pageEl = bookContainer.children[currentPageIndex];
            pageEl.classList.remove('flipped');
            updatePaginationUI();
            playFlipSound();
        }
    }

    function updatePaginationUI() {
         if (currentPageIndex === 0) {
             currentPageNumDisplay.textContent = 'الغلاف';
         } else {
             currentPageNumDisplay.textContent = currentPageIndex;
         }
         totalPagesNumDisplay.textContent = currentBook.pages.length;
     }

    // --- Actions ---

    closeBookBtn.addEventListener('click', () => {
        bookViewerPage.classList.remove('active');
        libraryPage.classList.add('active');
        currentBook = null;
        renderBooks();
        playClickSound();
    });

    nextPageBtn.addEventListener('click', nextPage);
    prevPageBtn.addEventListener('click', prevPage);

    addPageBtn.addEventListener('click', () => {
        addBlankPage();
        // Go to the new page
        setTimeout(() => {
            goToPage(currentBook.pages.length - 1);
        }, 100);
    });

    deleteBookBtn.addEventListener('click', () => {
        if (confirm('هل أنت متأكد من حذف هذا الكتاب نهائياً؟')) {
            books = books.filter(b => b.id !== currentBook.id);
            saveToLocalStorage();
            closeBookBtn.click();
        }
    });

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        playClickSound();
    });

    searchInput.addEventListener('input', (e) => {
        renderBooks(e.target.value);
    });

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        if (!currentBook) return;
        
        // Detect CTRL+B (Windows/Linux) or CMD+B (Mac)
        const isCtrlB = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b';

        if (isCtrlB) {
            e.preventDefault();
            createMainTitleAtCurrentPage();
        } else if (e.key === 'ArrowLeft') {
            nextPage();
        } else if (e.key === 'ArrowRight') {
            prevPage();
        } else if (e.key === 'Escape') {
            closeBookBtn.click();
        }
    });

    function createMainTitleAtCurrentPage() {
        // Find the active page content area based on currentPageIndex
        // Note: currentPageIndex 0 is cover, 1 is TOC, 2 is first content page
        // currentBook.pages[0] is TOC, [1] is first content page
        
        const actualPageIndex = currentPageIndex - 1; // Adjust for cover
        if (actualPageIndex < 0) return; // Don't add title to cover

        const contentArea = document.querySelector(`.page-content[data-index="${actualPageIndex}"]`);
        if (!contentArea) return;

        // Create a new Main Title (H2)
        const title = document.createElement('h2');
        title.textContent = 'عنوان رئيسي جديد';
        
        // Insert it at the top of the page
        if (contentArea.firstChild) {
            contentArea.insertBefore(title, contentArea.firstChild);
        } else {
            contentArea.appendChild(title);
        }
        
        // Focus and select the text for immediate editing
        title.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(title);
        sel.removeAllRanges();
        sel.addRange(range);
        
        // Trigger save and TOC update
        handleContentChange(actualPageIndex, contentArea.innerHTML);
    }

    // --- Backup & Restore ---

    // Keys persisted by this application. Only these are exported/restored.
    const BACKUP_STORAGE_KEYS = ['my_notebooks'];
    const BACKUP_FORMAT = 'my-notebook-backup';
    const BACKUP_FORMAT_VERSION = 1;

    const exportBackupBtn = document.getElementById('export-backup-btn');
    const importBackupBtn = document.getElementById('import-backup-btn');
    const importFileInput = document.getElementById('import-file-input');

    function buildBackupPayload() {
        const data = {};
        BACKUP_STORAGE_KEYS.forEach((key) => {
            const raw = localStorage.getItem(key);
            if (raw === null) return;
            try {
                data[key] = JSON.parse(raw);
            } catch (err) {
                data[key] = raw;
            }
        });

        return {
            format: BACKUP_FORMAT,
            formatVersion: BACKUP_FORMAT_VERSION,
            app: 'My Note Book',
            exportedAt: new Date().toISOString(),
            storageKeys: Object.keys(data),
            data: data
        };
    }

    function backupStamp() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    }

    function downloadBackupFile(fileName, text) {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // Rebuilds a safe book list from untrusted data. Returns null when the
    // structure is not usable, so callers can abort before touching storage.
    function normalizeBooks(rawBooks) {
        if (!Array.isArray(rawBooks)) return null;

        const normalized = [];
        for (const rawBook of rawBooks) {
            if (!rawBook || typeof rawBook !== 'object') return null;
            if (typeof rawBook.id !== 'string' || rawBook.id === '') return null;
            if (typeof rawBook.title !== 'string') return null;
            if (!Array.isArray(rawBook.pages)) return null;

            const pages = [];
            for (let i = 0; i < rawBook.pages.length; i++) {
                const rawPage = rawBook.pages[i];
                if (!rawPage || typeof rawPage !== 'object') return null;
                if (typeof rawPage.content !== 'string') return null;

                pages.push({
                    id: typeof rawPage.id === 'string' ? rawPage.id : 'page-' + i,
                    content: rawPage.content,
                    type: rawPage.type === 'toc' ? 'toc' : 'content'
                });
            }

            normalized.push({
                id: rawBook.id,
                title: rawBook.title,
                color: typeof rawBook.color === 'string' ? rawBook.color : '#2c3e50',
                createdAt: typeof rawBook.createdAt === 'string' ? rawBook.createdAt : new Date().toISOString(),
                pages: pages
            });
        }

        return normalized;
    }

    // Maps the supported backup shapes to a validated book list.
    // Supported: versioned backup, raw localStorage dump, bare books array.
    function extractBackupBooks(parsed) {
        let rawBooks;

        if (Array.isArray(parsed)) {
            rawBooks = parsed;
        } else if (parsed && typeof parsed === 'object') {
            if (typeof parsed.formatVersion === 'number' && parsed.formatVersion > BACKUP_FORMAT_VERSION) {
                return {
                    ok: false,
                    error: 'إصدار النسخة الاحتياطية (' + parsed.formatVersion + ') أحدث من الإصدار المدعوم. يرجى تحديث التطبيق.'
                };
            }
            if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
                rawBooks = parsed.data.my_notebooks;
            } else if (Array.isArray(parsed.my_notebooks)) {
                rawBooks = parsed.my_notebooks;
            }
        }

        if (rawBooks === undefined || rawBooks === null) {
            return { ok: false, error: 'تعذر التعرف على بنية الملف أو لا يحتوي على بيانات الكتب.' };
        }
        if (!Array.isArray(rawBooks)) {
            return { ok: false, error: 'حقل الكتب في الملف ليس بصيغة صحيحة.' };
        }

        const normalized = normalizeBooks(rawBooks);
        if (!normalized) {
            return { ok: false, error: 'بيانات الكتب تالفة أو ينقصها حقول مطلوبة.' };
        }

        return { ok: true, books: normalized };
    }

    exportBackupBtn.addEventListener('click', () => {
        playClickSound();

        const bookCount = books.length;
        const pageCount = books.reduce((sum, b) => sum + (Array.isArray(b.pages) ? b.pages.length : 0), 0);

        const confirmMessage =
            'سيتم إنشاء ملف نسخة احتياطية يحتوي على جميع بياناتك (' +
            bookCount + ' كتاب، ' + pageCount + ' صفحة) بما في ذلك المحتوى الخاص.\n\n' +
            'لن يتم رفع الملف إلى أي خادم خارجي. هل تريد المتابعة؟';
        if (!confirm(confirmMessage)) return;

        let text;
        try {
            text = JSON.stringify(buildBackupPayload(), null, 2);
        } catch (err) {
            alert('تعذر إنشاء النسخة الاحتياطية: البيانات غير قابلة للتحويل إلى صيغة JSON.');
            return;
        }

        downloadBackupFile('library-backup-' + backupStamp() + '.json', text);
        alert('تم إنشاء النسخة الاحتياطية بنجاح (' + bookCount + ' كتاب، ' + pageCount + ' صفحة). احتفظ بالملف في مكان آمن.');
    });

    importBackupBtn.addEventListener('click', () => {
        playClickSound();

        const proceed = confirm(
            'قبل الاستيراد، سيتم تنزيل نسخة احتياطية من بياناتك الحالية كإجراء وقائي.\n' +
            'هل تريد المتابعة؟'
        );
        if (!proceed) return;

        try {
            downloadBackupFile('library-backup-before-import-' + backupStamp() + '.json',
                JSON.stringify(buildBackupPayload(), null, 2));
        } catch (err) {
            alert('تعذر إنشاء النسخة الاحتياطية الوقائية. تم إلغاء الاستيراد.');
            return;
        }

        importFileInput.value = '';
        importFileInput.click();
    });

    importFileInput.addEventListener('change', () => {
        const file = importFileInput.files && importFileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => handleImportedText(String(reader.result));
        reader.onerror = () => alert('تعذر قراءة الملف المحدد.');
        reader.readAsText(file);
    });

    function handleImportedText(text) {
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (err) {
            alert('فشل الاستيراد: الملف ليس بصيغة JSON صالحة.');
            return;
        }

        const result = extractBackupBooks(parsed);
        if (!result.ok) {
            alert('فشل الاستيراد: ' + result.error);
            return;
        }

        const restoredBooks = result.books;
        const bookCount = restoredBooks.length;
        const pageCount = restoredBooks.reduce((sum, b) => sum + b.pages.length, 0);

        const summaryMessage =
            'ملخص النسخة الاحتياطية (بدون كشف المحتوى):\n' +
            '• عدد الكتب: ' + bookCount + '\n' +
            '• عدد الصفحات: ' + pageCount + '\n\n' +
            'تنبيه: سيتم استبدال بياناتك الحالية بالكامل ببيانات هذه النسخة الاحتياطية.\n' +
            'هل تريد المتابعة؟';
        if (!confirm(summaryMessage)) return;

        // Full validation already passed above. Keep a snapshot of the current
        // value so a storage failure can be rolled back safely.
        const previousRaw = localStorage.getItem('my_notebooks');
        const newRaw = JSON.stringify(restoredBooks);

        try {
            localStorage.setItem('my_notebooks', newRaw);
        } catch (err) {
            let rollbackOk = true;
            try {
                if (previousRaw === null) {
                    localStorage.removeItem('my_notebooks');
                } else {
                    localStorage.setItem('my_notebooks', previousRaw);
                }
            } catch (rollbackErr) {
                rollbackOk = false;
            }
            alert(
                'فشل الاستيراد: تعذر حفظ البيانات (قد تكون مساحة التخزين ممتلئة). ' +
                (rollbackOk ? 'تمت استعادة بياناتك الأصلية.' : 'تعذرت الاستعادة التلقائية، يرجى استخدام ملف النسخة الوقائية.')
            );
            return;
        }

        alert('تم الاستيراد بنجاح. سيتم إعادة تحميل التطبيق لتطبيق البيانات المستعادة.');
        location.reload();
    }

    // --- Helpers ---

    function saveToLocalStorage() {
        localStorage.setItem('my_notebooks', JSON.stringify(books));
    }

    function playFlipSound() {
        flipSound.currentTime = 0;
        flipSound.play().catch(e => console.log('Sound blocked'));
    }

    function playClickSound() {
        clickSound.currentTime = 0;
        clickSound.play().catch(e => console.log('Sound blocked'));
    }

    // Expose functions to the app object for onclick handlers
    window.app = {
        addPage: () => {
            addBlankPage();
            goToPage(currentBook.pages.length - 1);
        },
        deletePage: (index) => {
            if (currentBook.pages.filter(p => p.type === 'content').length <= 1) {
                alert('لا يمكن حذف آخر صفحة في الكتاب.');
                return;
            }

            if (confirm('هل أنت متأكد من حذف هذه الصفحة؟ لا يمكن التراجع عن هذا الإجراء.')) {
                // Remove the page from state
                currentBook.pages.splice(index, 1);
                
                // Save and full re-render for simplicity to ensure all indices and Z-indices are correct
                saveToLocalStorage();
                renderBookPages();
                updateTOC();
                
                // Adjust current page index if needed
                if (currentPageIndex >= currentBook.pages.length) {
                    currentPageIndex = currentBook.pages.length - 1;
                }
                updatePaginationUI();
                playClickSound();
            }
        },
        deleteBook: (bookId) => {
            if (confirm('هل أنت متأكد من حذف هذا الكتاب نهائياً؟ سيتم مسح جميع الصفحات والملاحظات.')) {
                books = books.filter(b => b.id !== bookId);
                saveToLocalStorage();
                renderBooks();
                playClickSound();
                
                // If the deleted book was the one being viewed, close it
                if (currentBook && currentBook.id === bookId) {
                    closeBookBtn.click();
                }
            }
        },
        editBook: (bookId) => {
            const book = books.find(b => b.id === bookId);
            if (!book) return;
            
            const newTitle = prompt('أدخل العنوان الجديد للكتاب:', book.title);
            if (newTitle && newTitle.trim() !== '') {
                book.title = newTitle.trim();
                saveToLocalStorage();
                renderBooks();
                
                // Update viewer title if currently viewing this book
                if (currentBook && currentBook.id === bookId) {
                    viewingBookTitle.textContent = book.title;
                    // Also update cover page title in DOM
                    renderBookPages();
                }
            }
        }
    };
});
