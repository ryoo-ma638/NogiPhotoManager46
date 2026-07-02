import SwiftUI
import Combine
import Vision
import CoreImage
import CoreImage.CIFilterBuiltins

// ★新設：Appleの制限を回避するための、自作の「写真データ」型
struct PhotoRect {
    let topLeft: CGPoint
    let topRight: CGPoint
    let bottomLeft: CGPoint
    let bottomRight: CGPoint
    let boundingBox: CGRect
    
    // 面積を計算する便利機能
    var area: CGFloat {
        return boundingBox.width * boundingBox.height
    }
}

class PhotoScanner: ObservableObject {
    @Published var isProcessing = false
    @Published var croppedImages: [UIImage] = []
    
    func detectAndCrop(image: UIImage) {
        self.isProcessing = true
        self.croppedImages = []
        
        guard let fixedImage = image.fixedOrientation(),
              let originalCIImage = CIImage(image: fixedImage) else {
            self.isProcessing = false; return
        }
        
        let imageSize = originalCIImage.extent.size
        
        DispatchQueue.global(qos: .userInitiated).async {
            var allObservations: [VNRectangleObservation] = []
            
            // 1. 検出実行（3パターン）
            allObservations.append(contentsOf: self.performDetection(on: originalCIImage))
            if let highContrast = self.applyContrastFilter(to: originalCIImage) {
                allObservations.append(contentsOf: self.performDetection(on: highContrast))
            }
            if let inverted = self.applyInvertFilter(to: originalCIImage) {
                 allObservations.append(contentsOf: self.performDetection(on: inverted))
            }
            
            // 2. 扱いやすい「自作の型(PhotoRect)」に変換する
            let photoRects = allObservations.map { obs in
                PhotoRect(topLeft: obs.topLeft, topRight: obs.topRight, bottomLeft: obs.bottomLeft, bottomRight: obs.bottomRight, boundingBox: obs.boundingBox)
            }
            
            // 3. ★合体処理（上下に分かれた写真をくっつける）
            let mergedRects = self.mergeVerticalSplits(photoRects)
            
            // 4. 重複除去
            let uniqueRects = self.removeDuplicates(mergedRects)
            
            // 5. 切り抜き実行
            let crops = uniqueRects.prefix(8).map { rect in
                self.perspectiveCorrectedImage(from: originalCIImage, rect: rect, expandRatio: 0.02)
            }
            
            DispatchQueue.main.async {
                self.croppedImages = crops.compactMap { $0 }
                self.isProcessing = false
            }
        }
    }
    
    private func performDetection(on ciImage: CIImage) -> [VNRectangleObservation] {
        let request = VNDetectRectanglesRequest()
        request.minimumConfidence = 0.1
        request.minimumAspectRatio = 0.35    // ヒキ（全身）対応
        request.maximumAspectRatio = 1.0     // ヨリ（正方形）対応
        request.minimumSize = 0.08
        request.quadratureTolerance = 45
        request.maximumObservations = 15
        
        let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
        do { try handler.perform([request]); return request.results ?? [] }
        catch { return [] }
    }
    
    // ★修正版：自作の型(PhotoRect)を使うのでエラーが出ない合体ロジック
    private func mergeVerticalSplits(_ rects: [PhotoRect]) -> [PhotoRect] {
        var merged = rects
        var hasChanges = true
        
        while hasChanges {
            hasChanges = false
            // Y座標（下から上）で並び替え
            merged.sort { $0.boundingBox.minY < $1.boundingBox.minY }
            
            var newMerged: [PhotoRect] = []
            var skipIndices: Set<Int> = []
            
            for i in 0..<merged.count {
                if skipIndices.contains(i) { continue }
                
                let r1 = merged[i]
                var didMerge = false
                
                for j in (i + 1)..<merged.count {
                    if skipIndices.contains(j) { continue }
                    let r2 = merged[j]
                    
                    // 判定：幅が近く、X位置が近く、上下の隙間が小さいか
                    let w1 = r1.boundingBox.width
                    let w2 = r2.boundingBox.width
                    let widthDiffRatio = abs(w1 - w2) / max(w1, w2)
                    
                    let xDiff = abs(r1.boundingBox.minX - r2.boundingBox.minX)
                    let xDiffRatio = xDiff / max(w1, w2)

                    let gap = r2.boundingBox.minY - r1.boundingBox.maxY
                    let avgHeight = (r1.boundingBox.height + r2.boundingBox.height) / 2
                    let gapRatio = gap / avgHeight
                    
                    // 合体条件クリア！
                    if widthDiffRatio < 0.15 && xDiffRatio < 0.15 && gapRatio < 0.05 && gapRatio > -0.05 {
                        
                        // 新しい合体四角を作る（2つを囲む最大範囲）
                        let newBox = r1.boundingBox.union(r2.boundingBox)
                        
                        // 四隅の座標を簡易的に計算（左下〜右上）
                        // ※単純な矩形として再構成します
                        let tl = CGPoint(x: newBox.minX, y: newBox.maxY)
                        let tr = CGPoint(x: newBox.maxX, y: newBox.maxY)
                        let bl = CGPoint(x: newBox.minX, y: newBox.minY)
                        let br = CGPoint(x: newBox.maxX, y: newBox.minY)
                        
                        let newRect = PhotoRect(topLeft: tl, topRight: tr, bottomLeft: bl, bottomRight: br, boundingBox: newBox)
                        
                        newMerged.append(newRect)
                        skipIndices.insert(j)
                        didMerge = true
                        hasChanges = true
                        break
                    }
                }
                
                if !didMerge {
                    newMerged.append(r1)
                }
            }
            merged = newMerged
        }
        return merged
    }
    
    // 重複除去（PhotoRect版）
    private func removeDuplicates(_ rects: [PhotoRect]) -> [PhotoRect] {
        let sorted = rects.sorted { $0.area > $1.area }
        var kept: [PhotoRect] = []
        for r in sorted {
            var isDuplicate = false
            for existing in kept {
                let intersection = r.boundingBox.intersection(existing.boundingBox)
                let areaIntersection = intersection.width * intersection.height
                let areaObs = r.area
                if areaObs > 0 && (areaIntersection / areaObs) > 0.5 {
                    isDuplicate = true; break
                }
            }
            if !isDuplicate { kept.append(r) }
        }
        return kept
    }
    
    // 切り抜き処理（PhotoRect版）
    private func perspectiveCorrectedImage(from inputImage: CIImage, rect: PhotoRect, expandRatio: CGFloat = 0.0) -> UIImage? {
        let imageSize = inputImage.extent.size
        var topLeft = rect.topLeft; var topRight = rect.topRight; var bottomLeft = rect.bottomLeft; var bottomRight = rect.bottomRight
        
        if expandRatio > 0 {
            let center = CGPoint(x: (topLeft.x + bottomRight.x)/2, y: (topLeft.y + bottomRight.y)/2)
            func expand(_ point: CGPoint) -> CGPoint {
                let dx = point.x - center.x; let dy = point.y - center.y
                return CGPoint(x: center.x + dx * (1 + expandRatio), y: center.y + dy * (1 + expandRatio))
            }
            topLeft = expand(topLeft); topRight = expand(topRight); bottomLeft = expand(bottomLeft); bottomRight = expand(bottomRight)
        }
        
        let tl = CGPoint(x: topLeft.x*imageSize.width, y: topLeft.y*imageSize.height)
        let tr = CGPoint(x: topRight.x*imageSize.width, y: topRight.y*imageSize.height)
        let bl = CGPoint(x: bottomLeft.x*imageSize.width, y: bottomLeft.y*imageSize.height)
        let br = CGPoint(x: bottomRight.x*imageSize.width, y: bottomRight.y*imageSize.height)
        
        let f = CIFilter.perspectiveCorrection()
        f.inputImage = inputImage; f.topLeft=tl; f.topRight=tr; f.bottomLeft=bl; f.bottomRight=br
        guard let out = f.outputImage else { return nil }
        let c = CIContext(); if let cg = c.createCGImage(out, from: out.extent) { return UIImage(cgImage: cg) }
        return nil
    }
    
    private func applyContrastFilter(to input: CIImage) -> CIImage? {
        let f = CIFilter.colorControls(); f.inputImage = input; f.contrast = 2.0; f.saturation = 0.0
        let edge = CIFilter.unsharpMask(); edge.inputImage = f.outputImage; edge.radius = 2.0; edge.intensity = 1.0
        return edge.outputImage
    }
    private func applyInvertFilter(to input: CIImage) -> CIImage? {
        let f = CIFilter.colorInvert(); f.inputImage = input; return f.outputImage
    }
}

// 向き補正拡張（カッコのエラー修正済み）
extension UIImage {
    func fixedOrientation() -> UIImage? {
        if imageOrientation == .up { return self }
        UIGraphicsBeginImageContextWithOptions(size, false, scale)
        draw(in: CGRect(origin: .zero, size: size)) // ★ここの閉じカッコ不足を修正しました
        let normalizedImage = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()
        return normalizedImage
    }
}
