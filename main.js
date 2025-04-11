document.addEventListener('DOMContentLoaded', () => {
    const excelFileInput = document.getElementById('excelFileInput');
    const bgImageInput = document.getElementById('bgImageInput');
    const columnSelector = document.getElementById('columnSelector');
    const templateEditor = document.getElementById('templateEditor');
    const styleControls = document.getElementById('styleControls');
    const generateButton = document.getElementById('generateButton');
    const outputArea = document.getElementById('outputArea');

    let excelData = []; // To store parsed Excel data (array of objects)
    let headers = [];   // To store Excel headers
    let selectedColumns = {}; // To store which columns user wants to display {headerName: true/false}
    let templateElements = {}; // To store references to draggable elements in the template {headerName: element}
    let elementStyles = {}; // To store styles for each element type {headerName: {fontFamily, fontSize, color, top, left}}
    let backgroundImageUrl = null; // To store the background image URL

    const DEFAULT_FONT_SIZE = 12; // Default font size in points (pt)
    const DEFAULT_FONT_FAMILY = 'Arial';
    const DEFAULT_COLOR = '#000000';
    const STANDARD_FONTS = ['Arial', 'Verdana', 'Tahoma', 'Times New Roman', 'Georgia', 'Courier New', 'Poppins', 'Roboto'];
    const DEFAULT_TEXT_ALIGN = 'left';
    const DEFAULT_WIDTH = 150; // Default width in pixels

    // --- 1. File Upload Handling ---

    bgImageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                backgroundImageUrl = e.target.result;
                templateEditor.style.backgroundImage = `url(${backgroundImageUrl})`;
                // Clear instruction text if present
                const instruction = templateEditor.querySelector('.template-instruction');
                if (instruction) instruction.remove();
            }
            reader.readAsDataURL(file);
        }
    });

    excelFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                try {
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    // Convert sheet to JSON array of objects, get headers explicitly
                    excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Get array of arrays first

                    if (excelData.length > 0) {
                        headers = excelData[0]; // First row is headers
                        excelData = XLSX.utils.sheet_to_json(worksheet); // Convert again, using headers now

                        console.log("Headers:", headers);
                        console.log("Data:", excelData);
                        populateColumnSelector(); // Update the UI
                    } else {
                        alert('Excel file seems empty.');
                        resetAppState();
                    }
                } catch (error) {
                    console.error("Error reading Excel file:", error);
                    alert('Error reading Excel file. Make sure it is a valid .xlsx file.');
                    resetAppState();
                }
            };
            reader.onerror = (error) => {
                 console.error("FileReader error:", error);
                 alert('Error reading file.');
                 resetAppState();
            }
            reader.readAsArrayBuffer(file);
        }
    });

    // --- 2. Column Selection ---

    function populateColumnSelector() {
        columnSelector.innerHTML = ''; // Clear previous options
        selectedColumns = {}; // Reset selections
        headers.forEach(header => {
            if(header && header.trim() !== '') { // Ensure header is not null or empty
                selectedColumns[header] = false; // Initially unselected

                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = header;
                checkbox.id = `col-${header.replace(/\s+/g, '-')}`; // Create a safe ID
                checkbox.addEventListener('change', handleColumnSelectionChange);

                label.htmlFor = checkbox.id;
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(` ${header}`));
                columnSelector.appendChild(label);
            }
        });
        updateTemplateEditorPlaceholders(); // Also update editor when columns are loaded
        updateStyleControls(); // Update style controls based on available headers
    }
 
    function handleColumnSelectionChange(event) {
        const header = event.target.value;
        const isSelected = event.target.checked;
        selectedColumns[header] = isSelected;
    
        if (isSelected && !elementStyles[header]) {
            console.log(`Initializing styles for ${header} in handleColumnSelectionChange`);
            let verticalOffset = 10;
            // Simple stacking logic based on existing element centers
            Object.keys(elementStyles).forEach(existingHeader => {
                verticalOffset = Math.max(verticalOffset, (elementStyles[existingHeader].top || 0) + 40); // Increase spacing slightly
            });
            // Ensure offset stays within bounds (considering center)
            verticalOffset = Math.max(verticalOffset, 20); // Min top offset
    
            elementStyles[header] = {
                top: verticalOffset, // Position now refers to center
                left: templateEditor.clientWidth / 2 || 200, // Default to horizontal center
                fontSize: DEFAULT_FONT_SIZE,
                fontFamily: DEFAULT_FONT_FAMILY,
                color: DEFAULT_COLOR,
                textAlign: DEFAULT_TEXT_ALIGN, // Add textAlign
                width: DEFAULT_WIDTH         // Add width
            };
        }
        updateTemplateEditorPlaceholders();
        updateStyleControls();
    }

 
    function updateTemplateEditorPlaceholders() {
        templateEditor.innerHTML = '';
        templateElements = {};
    
        if (!backgroundImageUrl) {
            const instruction = document.createElement('p');
            instruction.className = 'template-instruction';
            instruction.textContent = 'Upload background image to see preview...';
            templateEditor.appendChild(instruction);
        } else {
            templateEditor.style.backgroundImage = `url(${backgroundImageUrl})`;
        }
    
        if (backgroundImageUrl) {
            headers.forEach(header => {
                if (selectedColumns[header]) {
                    const style = elementStyles[header] || { /* default fallback */ };
    
                    const el = document.createElement('div');
                    el.classList.add('draggable-element'); // CSS will handle transform
                    el.textContent = `{${header}}`;
                    el.dataset.header = header;
                    // Apply styles
                    el.style.top = `${style.top}px`;
                    el.style.left = `${style.left}px`;
                    el.style.fontSize = `${style.fontSize}pt`;
                    el.style.fontFamily = style.fontFamily;
                    el.style.color = style.color;
                    el.style.textAlign = style.textAlign || DEFAULT_TEXT_ALIGN; // Apply textAlign
                    el.style.width = `${style.width || DEFAULT_WIDTH}px`;       // Apply width
    
                    templateEditor.appendChild(el);
                    templateElements[header] = el;
                    makeDraggable(el);
                }
            });
        }
    }
    

 
    function updateStyleControls() {
        styleControls.innerHTML = '<h3>Style Options</h3>';
        let hasSelectedColumns = false;
    
        headers.forEach(header => {
            if (selectedColumns[header]) {
                hasSelectedColumns = true;
                const styles = elementStyles[header];
                if (!styles) {
                     console.warn(`Styles for selected column ${header} not found! Skipping controls.`);
                     return;
                }
    
                const group = document.createElement('div');
                group.classList.add('control-group');
                group.innerHTML = `<h4>${header}</h4>`;
    
                // --- Existing controls (Font, Size, Color) ---
                // Font Family (keep as is)
                const fontLabel = document.createElement('label');
                fontLabel.textContent = 'Font:';
                const fontSelect = document.createElement('select');
                STANDARD_FONTS.forEach(font => {
                    const option = document.createElement('option');
                    option.value = font;
                    option.textContent = font;
                     // Use the guaranteed 'styles' object
                    if (font === styles.fontFamily) option.selected = true;
                    fontSelect.appendChild(option);
                });
                fontSelect.addEventListener('change', (e) => updateStyle(header, 'fontFamily', e.target.value));
                group.appendChild(fontLabel);
                group.appendChild(fontSelect);
                group.appendChild(document.createElement('br'));
    
                // Font Size (keep as is)
                const sizeLabel = document.createElement('label');
                sizeLabel.textContent = 'Size (pt):';
                const sizeInput = document.createElement('input');
                sizeInput.type = 'number';
                sizeInput.min = '6';
                sizeInput.max = '72';
                 // Use the guaranteed 'styles' object
                sizeInput.value = styles.fontSize;
                sizeInput.addEventListener('input', (e) => {
                    const newSize = parseInt(e.target.value, 10);
                    if (!isNaN(newSize)) { // Basic validation
                         updateStyle(header, 'fontSize', newSize);
                    }
                });
                group.appendChild(sizeLabel);
                group.appendChild(sizeInput);
                group.appendChild(document.createElement('br'));
    
                // Color (keep as is)
                const colorLabel = document.createElement('label');
                colorLabel.textContent = 'Color:';
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                 // Use the guaranteed 'styles' object
                colorInput.value = styles.color;
                colorInput.addEventListener('input', (e) => updateStyle(header, 'color', e.target.value));
                group.appendChild(colorLabel);
                group.appendChild(colorInput);
                group.appendChild(document.createElement('br')); 

                // Width
                const widthLabel = document.createElement('label');
                widthLabel.textContent = 'Width (px):';
                const widthInput = document.createElement('input');
                widthInput.type = 'number';
                widthInput.min = '20'; // Min width
                widthInput.max = templateEditor.clientWidth - 10 || 400; // Max width (approx)
                widthInput.value = styles.width || DEFAULT_WIDTH;
                widthInput.style.width = '80px'; // Make input smaller
                widthInput.addEventListener('input', (e) => {
                    const newWidth = parseInt(e.target.value, 10);
                    if (!isNaN(newWidth) && newWidth > 0) {
                         updateStyle(header, 'width', newWidth);
                    }
                });
                group.appendChild(widthLabel);
                group.appendChild(widthInput);
                group.appendChild(document.createElement('br'));
    
                // Text Align
                const alignLabel = document.createElement('label');
                alignLabel.textContent = 'Align:';
                group.appendChild(alignLabel);
                const alignContainer = document.createElement('div');
                alignContainer.style.display = 'inline-block'; // Keep buttons together
                ['left', 'center', 'right'].forEach(align => {
                    const btn = document.createElement('button');
                    btn.textContent = align.charAt(0).toUpperCase() + align.slice(1);
                    btn.style.padding = '3px 8px';
                    btn.style.margin = '0 2px';
                    // Highlight the active button (simple version)
                    if ((styles.textAlign || DEFAULT_TEXT_ALIGN) === align) {
                        btn.style.backgroundColor = '#ddd';
                        btn.style.fontWeight = 'bold';
                    }
                     btn.onclick = (e) => { // Use onclick for simplicity here
                         e.preventDefault(); // Prevent potential form submission issues
                         updateStyle(header, 'textAlign', align);
                         // Redraw controls to update button highlighting
                         updateStyleControls();
                     };
                    alignContainer.appendChild(btn);
                });
                group.appendChild(alignContainer);
                // --- End New Controls ---
    
                styleControls.appendChild(group);
            }
        });
         if (!hasSelectedColumns) {
            styleControls.innerHTML += '<p><i>Select columns to see style options...</i></p>';
        }
    }
 
    function updateStyle(header, property, value) {
        if (elementStyles[header] && templateElements[header]) {
            elementStyles[header][property] = value;
            const element = templateElements[header];
    
            switch (property) {
                case 'fontSize':
                    element.style.fontSize = `${value}pt`;
                    break;
                case 'fontFamily':
                    element.style.fontFamily = value;
                    break;
                case 'color':
                    element.style.color = value;
                    break;
                case 'textAlign': // New case
                    element.style.textAlign = value;
                    break;
                case 'width':     // New case
                    element.style.width = `${value}px`;
                    // Adjust drag boundaries might be needed if width changes significantly
                    // For now, just update style
                    break;
                // Note: top/left are updated directly in drag function
            }
        }
    }
 

    function makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
        element.onmousedown = dragMouseDown;
    
        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
    
        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
    
            // Calculate the new element's CENTER position:
            let newTop = element.offsetTop - pos2; // offsetTop/Left still reference the pre-transform origin
            let newLeft = element.offsetLeft - pos1;
    
            // --- Boundary check (relative to CENTER point) ---
            const elemWidth = element.offsetWidth; // Current width
            const elemHeight = element.offsetHeight; // Current height (can change with wrapping)
            const parentWidth = templateEditor.clientWidth;
            const parentHeight = templateEditor.clientHeight;
    
            // Min/Max center X position
            const minX = elemWidth / 2;
            const maxX = parentWidth - elemWidth / 2;
            // Min/Max center Y position
            const minY = elemHeight / 2;
            const maxY = parentHeight - elemHeight / 2;
    
            // Apply boundaries
            if (newLeft < minX) newLeft = minX;
            if (newLeft > maxX) newLeft = maxX;
            if (newTop < minY) newTop = minY;
            if (newTop > maxY) newTop = maxY;
            // --- End Boundary check ---
    
    
            element.style.top = newTop + "px";
            element.style.left = newLeft + "px";
    
             const header = element.dataset.header;
             if(elementStyles[header]) {
                elementStyles[header].top = newTop;
                elementStyles[header].left = newLeft;
             }
        }
    
        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            // Optional: Recalculate height/boundaries after drag if needed,
            // especially if text wrapping changed the element height significantly.
        }
    }
    // --- 4. Label Generation ---

    generateButton.addEventListener('click', () => {
        if (excelData.length === 0) {
            alert("Please upload and process an Excel file first.");
            return;
        }
        if (!backgroundImageUrl) {
            alert("Please upload a background image first.");
            return;
        }
        if (Object.values(selectedColumns).every(v => !v)) {
             alert("Please select at least one column to display on the label.");
             return;
        }

        generateLabelsForPrinting();
    });

    
    function generateLabelsForPrinting() {
        outputArea.innerHTML = ''; // Clear previous output
        const labelsPerPage = 4;
        let labelCount = 0;
        let pageDiv = null;
    
        excelData.forEach((row, index) => {
            if (labelCount % labelsPerPage === 0) {
                pageDiv = document.createElement('div');
                pageDiv.classList.add('print-page');
                outputArea.appendChild(pageDiv);
            }
    
            const labelDiv = document.createElement('div');
            labelDiv.classList.add('print-label');
            if (backgroundImageUrl) { // Ensure BG is applied only if loaded
                labelDiv.style.backgroundImage = `url(${backgroundImageUrl})`;
            }
    
    
            headers.forEach(header => {
                if (selectedColumns[header] && elementStyles[header]) {
                    const style = elementStyles[header];
                    const textDiv = document.createElement('div');
                    textDiv.classList.add('print-text'); // CSS class handles transform
                    textDiv.textContent = row[header] || '';
    
                    // Apply saved styles and position (center point)
                    textDiv.style.position = 'absolute';
                    textDiv.style.top = `${style.top}px`;
                    textDiv.style.left = `${style.left}px`;
                    textDiv.style.fontFamily = style.fontFamily;
                    textDiv.style.fontSize = `${style.fontSize}pt`;
                    textDiv.style.color = style.color;
                    // Apply new styles
                    textDiv.style.width = `${style.width || DEFAULT_WIDTH}px`;
                    textDiv.style.textAlign = style.textAlign || DEFAULT_TEXT_ALIGN;
    
                    labelDiv.appendChild(textDiv);
                }
            });
    
            pageDiv.appendChild(labelDiv);
            labelCount++;
        });
    
        setTimeout(() => {
             window.print();
        }, 250);
    }

    function resetAppState() {
        excelData = [];
        headers = [];
        selectedColumns = {};
        templateElements = {};
        elementStyles = {};
        // Don't reset background image on Excel error
        // backgroundImageUrl = null;
        // templateEditor.style.backgroundImage = 'none';
        columnSelector.innerHTML = '<p><i>Upload Excel file to see columns...</i></p>';
        styleControls.innerHTML = '<h3>Style Options</h3><p><i>Select columns to see style options...</i></p>';
        templateEditor.innerHTML = '<p class="template-instruction"><i>Upload background and select columns...</i></p>';
        outputArea.innerHTML = '';
        // Reset file input fields visually might be tricky/undesirable, user can select again
        // excelFileInput.value = null; // This often doesn't work for security reasons
    }


}); 