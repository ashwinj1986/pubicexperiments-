// Personal Kanban Board Application
(function() {
    'use strict';

    // Constants
    const STORAGE_KEY = 'kanban_tasks';
    const COLUMNS = ['todo', 'progress', 'done'];

    // State
    let tasks = [];
    let draggedTask = null;
    let draggedElement = null;
    let touchStartY = 0;
    let touchStartX = 0;
    let currentContextTask = null;

    // DOM Elements
    const elements = {
        board: document.getElementById('board'),
        addTaskBtn: document.getElementById('addTaskBtn'),
        modalOverlay: document.getElementById('modalOverlay'),
        taskModal: document.getElementById('taskModal'),
        taskForm: document.getElementById('taskForm'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        cancelBtn: document.getElementById('cancelBtn'),
        modalTitle: document.getElementById('modalTitle'),
        taskId: document.getElementById('taskId'),
        taskTitle: document.getElementById('taskTitle'),
        taskDescription: document.getElementById('taskDescription'),
        taskPriority: document.getElementById('taskPriority'),
        taskColumn: document.getElementById('taskColumn'),
        contextMenu: document.getElementById('contextMenu'),
        lists: {
            todo: document.getElementById('list-todo'),
            progress: document.getElementById('list-progress'),
            done: document.getElementById('list-done')
        },
        counts: {
            todo: document.getElementById('count-todo'),
            progress: document.getElementById('count-progress'),
            done: document.getElementById('count-done')
        }
    };

    // Initialize Application
    function init() {
        loadTasks();
        renderAllTasks();
        attachEventListeners();
    }

    // Load tasks from localStorage
    function loadTasks() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                tasks = JSON.parse(stored);
            } catch (e) {
                console.error('Error loading tasks:', e);
                tasks = [];
            }
        }
    }

    // Save tasks to localStorage
    function saveTasks() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }

    // Generate unique ID
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Create a new task
    function createTask(title, description, priority, column) {
        const task = {
            id: generateId(),
            title: title.trim(),
            description: description.trim(),
            priority,
            column,
            createdAt: new Date().toISOString()
        };
        tasks.push(task);
        saveTasks();
        return task;
    }

    // Update a task
    function updateTask(id, updates) {
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex !== -1) {
            tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
            saveTasks();
            return tasks[taskIndex];
        }
        return null;
    }

    // Delete a task
    function deleteTask(id) {
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex !== -1) {
            tasks.splice(taskIndex, 1);
            saveTasks();
            return true;
        }
        return false;
    }

    // Get tasks by column
    function getTasksByColumn(column) {
        return tasks.filter(t => t.column === column);
    }

    // Render task card HTML
    function createTaskElement(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.id = task.id;
        card.dataset.priority = task.priority;
        card.draggable = true;

        card.innerHTML = `
            <div class="task-title">${escapeHtml(task.title)}</div>
            ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
            <div class="task-meta">
                <span class="task-priority ${task.priority}">${task.priority}</span>
                <div class="task-actions">
                    <button class="btn-task-action edit" aria-label="Edit task" data-action="edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-task-action delete" aria-label="Delete task" data-action="delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        // Attach drag events
        attachDragEvents(card);

        // Attach action button events
        card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(task.id);
        });

        card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDeleteTask(task.id);
        });

        // Long press for context menu on mobile
        let longPressTimer;
        card.addEventListener('touchstart', (e) => {
            longPressTimer = setTimeout(() => {
                showContextMenu(e.touches[0].clientX, e.touches[0].clientY, task.id);
            }, 500);
        });

        card.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        });

        card.addEventListener('touchmove', () => {
            clearTimeout(longPressTimer);
        });

        return card;
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Render all tasks
    function renderAllTasks() {
        COLUMNS.forEach(column => {
            const list = elements.lists[column];
            const columnTasks = getTasksByColumn(column);

            list.innerHTML = '';

            if (columnTasks.length === 0) {
                list.innerHTML = `
                    <div class="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="9" y1="9" x2="15" y2="9"></line>
                            <line x1="9" y1="13" x2="15" y2="13"></line>
                            <line x1="9" y1="17" x2="12" y2="17"></line>
                        </svg>
                        <p>No tasks yet</p>
                    </div>
                `;
            } else {
                columnTasks.forEach(task => {
                    list.appendChild(createTaskElement(task));
                });
            }

            elements.counts[column].textContent = columnTasks.length;
        });
    }

    // Attach event listeners
    function attachEventListeners() {
        // Add task button
        elements.addTaskBtn.addEventListener('click', openAddModal);

        // Modal close buttons
        elements.closeModalBtn.addEventListener('click', closeModal);
        elements.cancelBtn.addEventListener('click', closeModal);
        elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === elements.modalOverlay) {
                closeModal();
            }
        });

        // Form submission
        elements.taskForm.addEventListener('submit', handleFormSubmit);

        // Context menu actions
        elements.contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', handleContextMenuAction);
        });

        // Close context menu on click outside
        document.addEventListener('click', (e) => {
            if (!elements.contextMenu.contains(e.target)) {
                closeContextMenu();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
                closeContextMenu();
            }
            // Ctrl/Cmd + N to add new task
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                openAddModal();
            }
        });

        // Attach drop zone events to columns
        COLUMNS.forEach(column => {
            const list = elements.lists[column];

            list.addEventListener('dragover', handleDragOver);
            list.addEventListener('dragenter', handleDragEnter);
            list.addEventListener('dragleave', handleDragLeave);
            list.addEventListener('drop', handleDrop);

            // Touch drop zones
            list.addEventListener('touchmove', handleTouchMove, { passive: false });
            list.addEventListener('touchend', handleTouchEnd);
        });
    }

    // Drag and Drop Events
    function attachDragEvents(card) {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);

        // Touch events for mobile drag and drop
        card.addEventListener('touchstart', handleTouchStart, { passive: true });
        card.addEventListener('touchmove', handleTouchDrag, { passive: false });
        card.addEventListener('touchend', handleTouchEnd);
    }

    function handleDragStart(e) {
        draggedTask = tasks.find(t => t.id === e.target.dataset.id);
        draggedElement = e.target;
        e.target.classList.add('dragging');

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedTask.id);

        // Add slight delay for visual feedback
        setTimeout(() => {
            e.target.classList.add('drag-placeholder');
        }, 0);
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging', 'drag-placeholder');
        document.querySelectorAll('.task-list').forEach(list => {
            list.classList.remove('drag-over');
        });
        draggedTask = null;
        draggedElement = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        // Only remove class if leaving the list itself
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        const list = e.currentTarget;
        list.classList.remove('drag-over');

        if (!draggedTask) return;

        const column = list.id.replace('list-', '');
        if (draggedTask.column !== column) {
            updateTask(draggedTask.id, { column });
            renderAllTasks();
        }
    }

    // Touch Drag and Drop
    let touchDragElement = null;
    let touchDragClone = null;
    let isDragging = false;

    function handleTouchStart(e) {
        if (e.target.closest('.btn-task-action')) return;

        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchDragElement = e.currentTarget;
    }

    function handleTouchDrag(e) {
        if (!touchDragElement) return;

        const touch = e.touches[0];
        const moveX = Math.abs(touch.clientX - touchStartX);
        const moveY = Math.abs(touch.clientY - touchStartY);

        // Start dragging after moving 10px
        if (!isDragging && (moveX > 10 || moveY > 10)) {
            isDragging = true;
            draggedTask = tasks.find(t => t.id === touchDragElement.dataset.id);

            // Create clone for visual feedback
            touchDragClone = touchDragElement.cloneNode(true);
            touchDragClone.style.position = 'fixed';
            touchDragClone.style.pointerEvents = 'none';
            touchDragClone.style.width = touchDragElement.offsetWidth + 'px';
            touchDragClone.style.zIndex = '9999';
            touchDragClone.style.opacity = '0.9';
            touchDragClone.style.transform = 'rotate(3deg)';
            document.body.appendChild(touchDragClone);

            touchDragElement.classList.add('drag-placeholder');
        }

        if (isDragging) {
            e.preventDefault();

            // Move clone
            touchDragClone.style.left = (touch.clientX - touchDragElement.offsetWidth / 2) + 'px';
            touchDragClone.style.top = (touch.clientY - 30) + 'px';

            // Highlight drop target
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const dropZone = elementBelow?.closest('.task-list');

            document.querySelectorAll('.task-list').forEach(list => {
                list.classList.remove('drag-over');
            });

            if (dropZone) {
                dropZone.classList.add('drag-over');
            }
        }
    }

    function handleTouchMove(e) {
        // This is for the drop zone touch move handling
    }

    function handleTouchEnd(e) {
        if (isDragging && draggedTask && touchDragClone) {
            const touch = e.changedTouches[0];
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const dropZone = elementBelow?.closest('.task-list');

            if (dropZone) {
                const column = dropZone.id.replace('list-', '');
                if (draggedTask.column !== column) {
                    updateTask(draggedTask.id, { column });
                }
            }

            // Cleanup
            touchDragClone.remove();
            touchDragClone = null;
            touchDragElement.classList.remove('drag-placeholder');

            document.querySelectorAll('.task-list').forEach(list => {
                list.classList.remove('drag-over');
            });

            renderAllTasks();
        }

        isDragging = false;
        touchDragElement = null;
        draggedTask = null;
    }

    // Modal Functions
    function openAddModal() {
        elements.modalTitle.textContent = 'Add Task';
        elements.taskForm.reset();
        elements.taskId.value = '';
        elements.taskColumn.value = 'todo';
        elements.modalOverlay.classList.add('active');
        setTimeout(() => elements.taskTitle.focus(), 100);
    }

    function openEditModal(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        elements.modalTitle.textContent = 'Edit Task';
        elements.taskId.value = task.id;
        elements.taskTitle.value = task.title;
        elements.taskDescription.value = task.description || '';
        elements.taskPriority.value = task.priority;
        elements.taskColumn.value = task.column;
        elements.modalOverlay.classList.add('active');
        setTimeout(() => elements.taskTitle.focus(), 100);
    }

    function closeModal() {
        elements.modalOverlay.classList.remove('active');
        elements.taskForm.reset();
    }

    function handleFormSubmit(e) {
        e.preventDefault();

        const id = elements.taskId.value;
        const title = elements.taskTitle.value;
        const description = elements.taskDescription.value;
        const priority = elements.taskPriority.value;
        const column = elements.taskColumn.value;

        if (!title.trim()) return;

        if (id) {
            // Update existing task
            updateTask(id, { title, description, priority, column });
        } else {
            // Create new task
            createTask(title, description, priority, column);
        }

        closeModal();
        renderAllTasks();
    }

    // Context Menu Functions
    function showContextMenu(x, y, taskId) {
        currentContextTask = taskId;
        const menu = elements.contextMenu;

        // Position menu
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // Adjust if off screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (y - rect.height) + 'px';
        }

        menu.classList.add('active');
    }

    function closeContextMenu() {
        elements.contextMenu.classList.remove('active');
        currentContextTask = null;
    }

    function handleContextMenuAction(e) {
        const action = e.currentTarget.dataset.action;

        if (!currentContextTask) return;

        if (action === 'edit') {
            openEditModal(currentContextTask);
        } else if (action === 'delete') {
            confirmDeleteTask(currentContextTask);
        }

        closeContextMenu();
    }

    // Delete confirmation
    function confirmDeleteTask(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        if (confirm(`Delete "${task.title}"?`)) {
            deleteTask(taskId);
            renderAllTasks();
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
