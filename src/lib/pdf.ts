import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import { PDFFileItem, ProcessingSettings, FontType, MarginSettings, LineStyle } from '../types';

function hexToRgb(hex: string) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

const FONT_MAP: Record<FontType, StandardFonts> = {
  'Helvetica': StandardFonts.Helvetica,
  'Helvetica-Bold': StandardFonts.HelveticaBold,
  'Times-Roman': StandardFonts.TimesRoman,
  'Times-Bold': StandardFonts.TimesRomanBold,
  'Courier': StandardFonts.Courier,
  'Courier-Bold': StandardFonts.CourierBold,
  'Segoe UI': StandardFonts.Helvetica, // Map to Helvetica fallback
  'Segoe UI-Bold': StandardFonts.HelveticaBold, // Map to Helvetica Bold fallback
};

function getPt(val: number, unit: 'pt' | 'cm'): number {
  return unit === 'cm' ? val * 28.346 : val;
}

function getDashArray(style: LineStyle, thickness: number): number[] | undefined {
  if (style === 'dashed') return [thickness * 5, thickness * 5];
  if (style === 'dotted') return [thickness, thickness * 3];
  return undefined;
}

function wrapText(text: string, width: number, font: PDFFont, fontSize: number): string[] {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const widthOfCurrentLine = font.widthOfTextAtSize(currentLine + ' ' + word, fontSize);
    if (widthOfCurrentLine < width) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function processPDFs(
  files: PDFFileItem[],
  settings: ProcessingSettings,
  onProgress?: (progress: number) => void
): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  
  // Cache embedded fonts
  const fontCache: Partial<Record<StandardFonts, PDFFont>> = {};
  for (const fontName of Object.values(FONT_MAP)) {
    if (!fontCache[fontName]) {
       fontCache[fontName] = await mergedPdf.embedFont(fontName);
    }
  }
  
  // Cache embedded images
  let leftImageEmbed = null;
  let rightImageEmbed = null;

  const defaultLeftUrl = '/default_left_image.png';
  const defaultRightUrl = '/default_right_image.png';

  try {
    const leftUrl = settings.header.useDefaultImages ? defaultLeftUrl : settings.header.leftImage;
    if (leftUrl) {
      const res = await fetch(leftUrl);
      if (res.ok) {
         const arr = await res.arrayBuffer();
         if (arr.byteLength > 0) {
            leftImageEmbed = leftUrl.includes('png') || leftUrl.startsWith('data:image/png') ? await mergedPdf.embedPng(arr) : await mergedPdf.embedJpg(arr);
         } else {
            console.warn('Left image file is empty (0 bytes).');
         }
      } else {
         console.warn(`Failed to fetch left image: ${res.status}`);
      }
    }
  } catch (e) {
     console.warn('Could not load left image:', e);
  }

  try {
    const rightUrl = settings.header.useDefaultImages ? defaultRightUrl : settings.header.rightImage;
    if (rightUrl) {
      const res = await fetch(rightUrl);
      if (res.ok) {
         const arr = await res.arrayBuffer();
         if (arr.byteLength > 0) {
            rightImageEmbed = rightUrl.includes('png') || rightUrl.startsWith('data:image/png') ? await mergedPdf.embedPng(arr) : await mergedPdf.embedJpg(arr);
         } else {
            console.warn('Right image file is empty (0 bytes).');
         }
      } else {
         console.warn(`Failed to fetch right image: ${res.status}`);
      }
    }
  } catch (e) {
     console.warn('Could not load right image:', e);
  }

  const coversFile = files.find(f => f.isCoversPdf);
  let coversDoc: PDFDocument | null = null;
  if (coversFile) {
     coversDoc = await PDFDocument.load(await coversFile.file.arrayBuffer(), { ignoreEncryption: true });
  }

  type PageMeta = { isCover: boolean, file: PDFFileItem };
  const pageMetaMap: PageMeta[] = [];
  
  let filesProcessed = 0;

  for (const file of files) {
      if (file.isCoversPdf) {
          if (file.coverSettings.useCover && coversDoc) {
              const start = Math.max(0, file.coverSettings.coverPageStart - 1);
              const end = Math.min(coversDoc.getPageCount() - 1, file.coverSettings.coverPageEnd - 1);
              if (start <= end) {
                  const indices = Array.from({length: end - start + 1}, (_, i) => start + i);
                  const copied = await mergedPdf.copyPages(coversDoc, indices);
                  for (const p of copied) {
                      mergedPdf.addPage(p);
                      pageMetaMap.push({ isCover: true, file });
                  }
              }
          }
      } else {
          if (file.coverSettings.useCover && coversDoc) {
              const start = Math.max(0, file.coverSettings.coverPageStart - 1);
              const end = Math.min(coversDoc.getPageCount() - 1, file.coverSettings.coverPageEnd - 1);
              if (start <= end) {
                  const indices = Array.from({length: end - start + 1}, (_, i) => start + i);
                  const copied = await mergedPdf.copyPages(coversDoc, indices);
                  for (const p of copied) {
                      mergedPdf.addPage(p);
                      pageMetaMap.push({ isCover: true, file });
                  }
              }
          }
          const doc = await PDFDocument.load(await file.file.arrayBuffer(), { ignoreEncryption: true });
          const copied = await mergedPdf.copyPages(doc, doc.getPageIndices());
          for (const p of copied) {
              mergedPdf.addPage(p);
              pageMetaMap.push({ isCover: false, file });
          }
      }
      filesProcessed++;
      if (onProgress) onProgress((filesProcessed / files.length) * 0.5);
  }

  const totalPages = mergedPdf.getPageCount();
  const pages = mergedPdf.getPages();
  const unit = settings.measurementUnit;

  for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      const meta = pageMetaMap[i];
      const currentFile = meta.file;
      const { width, height } = page.getSize();
      
      if (currentFile.applyWhiteBorders) {
          const m: MarginSettings = currentFile.useCustomMargins && currentFile.margins 
              ? currentFile.margins 
              : settings.globalMargins;
          
          const mt = getPt(m.top, unit);
          const mb = getPt(m.bottom, unit);
          const ml = getPt(m.left, unit);
          const mr = getPt(m.right, unit);
          const white = rgb(1,1,1);
          
          if (mt > 0) page.drawRectangle({ x: 0, y: height - mt, width: width, height: mt, color: white });
          if (mb > 0) page.drawRectangle({ x: 0, y: 0, width: width, height: mb, color: white });
          if (ml > 0) page.drawRectangle({ x: 0, y: 0, width: ml, height: height, color: white });
          if (mr > 0) page.drawRectangle({ x: width - mr, y: 0, width: mr, height: height, color: white });
      }

      if (!meta.isCover && currentFile.applyAnnotations) {
          // --- HEADER ---
          const hm_top = getPt(settings.header.marginTop, unit);
          const hm_side = getPt(settings.header.sideMargin, unit);
          const hm_height = getPt(settings.header.height, unit);
          
          const h_boxX = hm_side;
          const h_boxY = height - hm_top - hm_height;
          const h_boxW = width - (hm_side * 2);

          const h_borderColor = hexToRgb(settings.header.frameStyle.color);
          const h_borderDash = getDashArray(settings.header.frameStyle.style, settings.header.frameStyle.thickness);
          
          page.drawRectangle({
              x: h_boxX, y: h_boxY, width: h_boxW, height: hm_height,
              borderColor: h_borderColor, borderWidth: settings.header.frameStyle.thickness,
              borderDashArray: h_borderDash
          });

          const centerRatio = settings.header.centralTextWidthPercent / 100;
          const centerW = h_boxW * centerRatio;
          const sideW = (h_boxW - centerW) / 2;
          
          const leftLineX = h_boxX + sideW;
          const rightLineX = leftLineX + centerW;

          page.drawLine({
              start: { x: leftLineX, y: h_boxY }, end: { x: leftLineX, y: h_boxY + hm_height },
              color: h_borderColor, thickness: settings.header.frameStyle.thickness, dashArray: h_borderDash
          });
          page.drawLine({
              start: { x: rightLineX, y: h_boxY }, end: { x: rightLineX, y: h_boxY + hm_height },
              color: h_borderColor, thickness: settings.header.frameStyle.thickness, dashArray: h_borderDash
          });

          if (leftImageEmbed) {
             const scale = Math.min((sideW - 4) / leftImageEmbed.width, (hm_height - 4) / leftImageEmbed.height);
             page.drawImage(leftImageEmbed, {
                 x: h_boxX + (sideW - leftImageEmbed.width * scale) / 2,
                 y: h_boxY + (hm_height - leftImageEmbed.height * scale) / 2,
                 width: leftImageEmbed.width * scale, height: leftImageEmbed.height * scale
             });
          }
          if (rightImageEmbed) {
             const scale = Math.min((sideW - 4) / rightImageEmbed.width, (hm_height - 4) / rightImageEmbed.height);
             page.drawImage(rightImageEmbed, {
                 x: rightLineX + (sideW - rightImageEmbed.width * scale) / 2,
                 y: h_boxY + (hm_height - rightImageEmbed.height * scale) / 2,
                 width: rightImageEmbed.width * scale, height: rightImageEmbed.height * scale
             });
          }

          const h_ts = settings.header.textStyle;
          const f_header = fontCache[FONT_MAP[h_ts.font]]!;
          const hPadding = 10;
          const hAvailW = centerW - (hPadding * 2);
          const hLines = wrapText(settings.header.titleText, hAvailW, f_header, h_ts.size);
          const hLineH = h_ts.size * 1.2;
          let hStartY = h_boxY + (hm_height / 2) + ((hLines.length * hLineH) / 2);

          for (let j = 0; j < hLines.length; j++) {
             const line = hLines[j];
             const lineW = f_header.widthOfTextAtSize(line, h_ts.size);
             let txtX = leftLineX + hPadding;
             if (h_ts.align === 'center') txtX = leftLineX + (centerW - lineW) / 2;
             if (h_ts.align === 'right') txtX = rightLineX - lineW - hPadding;
             
             hStartY -= h_ts.size;
             page.drawText(line, { x: txtX, y: hStartY, size: h_ts.size, font: f_header, color: hexToRgb(h_ts.color) });
             hStartY -= (hLineH - h_ts.size);
          }

          // --- FOOTER ---
          const fm_bot = getPt(settings.footer.marginBottom, unit);
          const fm_side = getPt(settings.footer.sideMargin, unit);
          const fm_height = getPt(settings.footer.height, unit);
          
          const f_boxX = fm_side;
          const f_boxY = fm_bot;
          const f_boxW = width - (fm_side * 2);

          const f_borderColor = hexToRgb(settings.footer.frameStyle.color);
          const f_borderDash = getDashArray(settings.footer.frameStyle.style, settings.footer.frameStyle.thickness);
          
          page.drawRectangle({
              x: f_boxX, y: f_boxY, width: f_boxW, height: fm_height,
              borderColor: f_borderColor, borderWidth: settings.footer.frameStyle.thickness,
              borderDashArray: f_borderDash
          });

          const leftW = f_boxW * (settings.footer.leftWidthPercent / 100);
          const vLineX = f_boxX + leftW;

          page.drawLine({
              start: { x: vLineX, y: f_boxY }, end: { x: vLineX, y: f_boxY + fm_height },
              color: f_borderColor, thickness: settings.footer.frameStyle.thickness, dashArray: f_borderDash
          });

          const statTS = settings.footer.staticTextStyle;
          const custTS = settings.footer.customTextStyle;
          const f_stat = fontCache[FONT_MAP[statTS.font]]!;
          const f_cust = fontCache[FONT_MAP[custTS.font]]!;
          
          const fPad = 5;
          const fLeftAvail = leftW - (fPad * 2);
          const fStatLines = wrapText(settings.footer.staticText, fLeftAvail, f_stat, statTS.size);
          const fCustLines = wrapText(currentFile.footerCustomText, fLeftAvail, f_cust, custTS.size);
          
          const statLH = statTS.size * 1.2;
          const custLH = custTS.size * 1.2;
          const totalLeftH = (fStatLines.length * statLH) + (fCustLines.length * custLH);
          let fStartY = f_boxY + (fm_height / 2) + (totalLeftH / 2);

          for (let j = 0; j < fStatLines.length; j++) {
             const line = fStatLines[j];
             const lineW = f_stat.widthOfTextAtSize(line, statTS.size);
             let txtX = f_boxX + fPad;
             if (statTS.align === 'center') txtX = f_boxX + (leftW - lineW) / 2;
             if (statTS.align === 'right') txtX = vLineX - lineW - fPad;
             
             fStartY -= statTS.size;
             page.drawText(line, { x: txtX, y: fStartY, size: statTS.size, font: f_stat, color: hexToRgb(statTS.color) });
             fStartY -= (statLH - statTS.size);
          }
          
          for (let j = 0; j < fCustLines.length; j++) {
             const line = fCustLines[j];
             const lineW = f_cust.widthOfTextAtSize(line, custTS.size);
             let txtX = f_boxX + fPad;
             if (custTS.align === 'center') txtX = f_boxX + (leftW - lineW) / 2;
             if (custTS.align === 'right') txtX = vLineX - lineW - fPad;
             
             fStartY -= custTS.size;
             page.drawText(line, { x: txtX, y: fStartY, size: custTS.size, font: f_cust, color: hexToRgb(custTS.color) });
             fStartY -= (custLH - custTS.size);
          }

          // Pagination right side
          const pagTS = settings.footer.paginationStyle;
          const f_pag = fontCache[FONT_MAP[pagTS.font]]!;
          const rightW = f_boxW - leftW;
          const pagText = `${i + 1}/${totalPages}`;
          const pagW = f_pag.widthOfTextAtSize(pagText, pagTS.size);
          
          let pagX = vLineX + fPad;
          if (pagTS.align === 'center') pagX = vLineX + (rightW - pagW) / 2;
          if (pagTS.align === 'right') pagX = f_boxX + f_boxW - pagW - fPad;

          page.drawText(pagText, {
              x: pagX, y: f_boxY + (fm_height / 2) - (pagTS.size / 3), size: pagTS.size, font: f_pag, color: hexToRgb(pagTS.color)
          });
      }
      
      if (onProgress) onProgress(0.5 + ((i / totalPages) * 0.5));
  }

  return await mergedPdf.save();
}

export function downloadFile(data: Uint8Array, filename: string) {
  const blob = new Blob([data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
