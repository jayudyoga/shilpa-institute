
'use client';

/**
 * Utility for connecting to and printing with PT-210 Bluetooth Thermal Printers (58mm)
 * using the Web Bluetooth API and ESC/POS commands.
 */

const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const PRINTER_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const INIT = ESC + '@';
const ALIGN_LEFT = ESC + 'a' + '\x00';
const ALIGN_CENTER = ESC + 'a' + '\x01';
const ALIGN_RIGHT = ESC + 'a' + '\x02';
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const DOUBLE_HEIGHT = GS + '!' + '\x01';
const RESET_SIZE = GS + '!' + '\x00';
const LINE_FEED = '\n';

export interface PrintData {
  receiptNumber: string;
  studentName: string;
  className: string;
  amount: number;
  date: Date;
  recordedBy: string;
  config?: {
    instituteName?: string;
    address1?: string;
    address2?: string;
    phone?: string;
    footer?: string;
  };
}

export class BluetoothPrinter {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(navigator && (navigator as any).bluetooth);
  }

  async connect(): Promise<boolean> {
    try {
      if (!this.isSupported()) {
        throw new Error('Web Bluetooth is not supported in this browser.');
      }

      this.device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: [PRINTER_SERVICE_UUID] },
          { namePrefix: 'PT-210' },
          { namePrefix: 'MTP' }
        ],
        optionalServices: [PRINTER_SERVICE_UUID]
      });

      const server = await this.device?.gatt?.connect();
      const service = await server?.getPrimaryService(PRINTER_SERVICE_UUID);
      this.characteristic = (await service?.getCharacteristic(PRINTER_CHARACTERISTIC_UUID)) || null;

      if (this.characteristic && this.device) {
        localStorage.setItem('last_printer_name', this.device.name || 'PT-210');
      }

      return !!this.characteristic;
    } catch (error: any) {
      console.error('Bluetooth connection failed:', error);
      if (error.name === 'NotFoundError') throw new Error('No printer selected.');
      throw error;
    }
  }

  async printReceipt(data: PrintData) {
    if (!this.characteristic) {
      const connected = await this.connect();
      if (!connected) throw new Error('Printer not connected.');
    }

    const encoder = new TextEncoder();
    const formattedDate = data.date.toLocaleDateString() + ' ' + data.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const config = data.config || {};

    let receipt = INIT;
    
    // Header
    receipt += ALIGN_CENTER + BOLD_ON + DOUBLE_HEIGHT + (config.instituteName || "SHILPA INSTITUTE") + LINE_FEED;
    receipt += RESET_SIZE + BOLD_OFF;
    if (config.address1) receipt += config.address1 + LINE_FEED;
    if (config.address2) receipt += config.address2 + LINE_FEED;
    if (config.phone) receipt += "Tel: " + config.phone + LINE_FEED;
    receipt += "--------------------------------" + LINE_FEED;
    receipt += "OFFICIAL RECEIPT" + LINE_FEED;
    receipt += "--------------------------------" + LINE_FEED + LINE_FEED;

    // Body
    receipt += ALIGN_LEFT;
    receipt += `Receipt: #${data.receiptNumber}` + LINE_FEED;
    receipt += `Date   : ${formattedDate}` + LINE_FEED;
    receipt += `Student: ${data.studentName}` + LINE_FEED;
    receipt += `Class  : ${data.className}` + LINE_FEED;
    receipt += `Admin  : ${data.recordedBy || 'System'}` + LINE_FEED + LINE_FEED;

    // Total
    receipt += ALIGN_CENTER + BOLD_ON + DOUBLE_HEIGHT;
    receipt += `TOTAL: $${data.amount.toFixed(2)}` + LINE_FEED;
    receipt += RESET_SIZE + BOLD_OFF + "--------------------------------" + LINE_FEED;
    
    // Footer
    receipt += ALIGN_CENTER + (config.footer || "Thank you for your payment!") + LINE_FEED;
    receipt += LINE_FEED + LINE_FEED + LINE_FEED + LINE_FEED;

    const encoded = encoder.encode(receipt);
    const CHUNK_SIZE = 20;
    for (let i = 0; i < encoded.length; i += CHUNK_SIZE) {
      const chunk = encoded.slice(i, i + CHUNK_SIZE);
      await this.characteristic?.writeValue(chunk);
    }
  }

  async printStudentIDCard(studentId: string, studentName: string, grade: string) {
    if (!this.characteristic) {
      const connected = await this.connect();
      if (!connected) throw new Error('Printer not connected.');
    }

    const encoder = new TextEncoder();
    let card = INIT;
    
    // Header
    card += ALIGN_CENTER + BOLD_ON + DOUBLE_HEIGHT + "SHILPA INSTITUTE" + LINE_FEED;
    card += RESET_SIZE + BOLD_OFF;
    card += "================================" + LINE_FEED;
    card += BOLD_ON + "STUDENT ID CARD" + BOLD_OFF + LINE_FEED;
    card += "================================" + LINE_FEED + LINE_FEED;

    // Body
    card += ALIGN_LEFT;
    card += `NAME : ${studentName}` + LINE_FEED;
    card += `GRADE: ${grade}` + LINE_FEED;
    card += `ID   : ${studentId}` + LINE_FEED + LINE_FEED;

    card += "--------------------------------" + LINE_FEED;
    card += ALIGN_CENTER;
    card += "Keep this slip safe." + LINE_FEED;
    card += "Scan at the center portal" + LINE_FEED;
    card += "to mark your attendance." + LINE_FEED;
    card += "================================" + LINE_FEED;
    card += LINE_FEED + LINE_FEED + LINE_FEED + LINE_FEED;

    const encoded = encoder.encode(card);
    const CHUNK_SIZE = 20;
    for (let i = 0; i < encoded.length; i += CHUNK_SIZE) {
      const chunk = encoded.slice(i, i + CHUNK_SIZE);
      await this.characteristic?.writeValue(chunk);
    }
  }

  async printTest() {
    if (!this.characteristic) await this.connect();
    const encoder = new TextEncoder();
    let test = INIT + ALIGN_CENTER + BOLD_ON + "PRINTER READY" + LINE_FEED;
    test += BOLD_OFF + "Connection Test Successful" + LINE_FEED + LINE_FEED + LINE_FEED;
    await this.characteristic?.writeValue(encoder.encode(test));
  }

  disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
  }
}

export const printerService = new BluetoothPrinter();
