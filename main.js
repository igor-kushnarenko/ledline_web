const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
let marqueeWindow;
const dataFile = path.join(__dirname, 'data.json'); // Путь к data.json в папке проекта

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile('index.html');

    mainWindow.on('closed', () => {
        if (marqueeWindow && !marqueeWindow.isDestroyed()) {
            marqueeWindow.close();
        }
        mainWindow = null;
    });
}

function createMarqueeWindow() {
    const displays = screen.getAllDisplays();
    const targetDisplay = displays.length > 1 ? displays[1] : displays[0];
    const { width, height } = targetDisplay.workArea;

    marqueeWindow = new BrowserWindow({
        width: width,
        height: Math.floor(height * 0.1),
        x: targetDisplay.bounds.x,
        y: targetDisplay.bounds.y,
        frame: false,
        resizable: true,
        movable: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    marqueeWindow.loadFile('marquee.html');

    // Отправляем настройки после полной загрузки окна
    marqueeWindow.webContents.on('did-finish-load', () => {
        console.log('Окно бегущей строки загружено, отправляем настройки');
        const { settings } = loadData();
        if (marqueeWindow && !marqueeWindow.isDestroyed()) {
            marqueeWindow.webContents.send('update-settings', settings);
        }
    });

    marqueeWindow.on('closed', () => {
        marqueeWindow = null;
    });
}

// Загрузка данных из файла при старте
function loadData() {
    try {
        if (fs.existsSync(dataFile)) {
            const data = fs.readFileSync(dataFile, 'utf8');
            const parsedData = JSON.parse(data);
            // Проверяем, чтобы структура данных была корректной
            return {
                lines: Array.isArray(parsedData.lines) ? parsedData.lines : [],
                settings: {
                    backgroundColor: typeof parsedData.settings?.backgroundColor === 'string' ? parsedData.settings.backgroundColor : '#000',
                    textColor: typeof parsedData.settings?.textColor === 'string' ? parsedData.settings.textColor : '#fff',
                    fontFamily: typeof parsedData.settings?.fontFamily === 'string' ? parsedData.settings.fontFamily : 'Arial, sans-serif',
                    fontSize: typeof parsedData.settings?.fontSize === 'number' ? parsedData.settings.fontSize : 24,
                    scrollSpeed: typeof parsedData.settings?.scrollSpeed === 'number' ? parsedData.settings.scrollSpeed : 10
                }
            };
        }
        // Если файла нет, возвращаем дефолтные значения
        return {
            lines: [],
            settings: {
                backgroundColor: '#000',
                textColor: '#fff',
                fontFamily: 'Arial, sans-serif',
                fontSize: 24,
                scrollSpeed: 10
            }
        };
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        // В случае ошибки возвращаем дефолтные значения
        return {
            lines: [],
            settings: {
                backgroundColor: '#000',
                textColor: '#fff',
                fontFamily: 'Arial, sans-serif',
                fontSize: 24,
                scrollSpeed: 10
            }
        };
    }
}

// Сохранение данных в файл
function saveData(data) {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Ошибка сохранения данных:', err);
    }
}

app.whenReady().then(() => {
    createMainWindow();
    createMarqueeWindow();

    // Отправляем сохранённые данные в главное окно при запуске
    const { lines, settings } = loadData();
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('load-data', { lines, settings });
    });
});

// Обработка обновления списка строк
ipcMain.on('update-marquee', (event, data) => {
    if (marqueeWindow && !marqueeWindow.isDestroyed()) {
        marqueeWindow.webContents.send('update-marquee', data);
    }
    // Загружаем текущие данные, обновляем только lines, сохраняя settings
    const currentData = loadData();
    saveData({
        lines: Array.isArray(data) ? data : currentData.lines,
        settings: currentData.settings
    });
});

// Обработка обновления настроек
ipcMain.on('apply-settings', (event, newSettings) => {
    console.log('Получены настройки для применения:', newSettings);
    if (marqueeWindow && !marqueeWindow.isDestroyed()) {
        marqueeWindow.webContents.send('update-settings', newSettings);
    }
    // Загружаем текущие данные, обновляем только settings, сохраняя lines
    const currentData = loadData();
    saveData({
        lines: currentData.lines,
        settings: {
            backgroundColor: typeof newSettings.backgroundColor === 'string' ? newSettings.backgroundColor : currentData.settings.backgroundColor,
            textColor: typeof newSettings.textColor === 'string' ? newSettings.textColor : currentData.settings.textColor,
            fontFamily: typeof newSettings.fontFamily === 'string' ? newSettings.fontFamily : currentData.settings.fontFamily,
            fontSize: typeof newSettings.fontSize === 'number' ? newSettings.fontSize : currentData.settings.fontSize,
            scrollSpeed: typeof newSettings.scrollSpeed === 'number' ? newSettings.scrollSpeed : currentData.settings.scrollSpeed
        }
    });
});

// Обработка запроса настроек
ipcMain.on('request-settings', (event) => {
    const { settings } = loadData();
    console.log('Запрос настроек, отправляем:', settings);
    event.sender.send('send-settings', settings);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
        createMarqueeWindow();
    }
});