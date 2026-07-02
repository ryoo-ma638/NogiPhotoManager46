import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct ScanTestView: View {
    @StateObject private var scanner = PhotoScanner()
    
    // 画像選択用
    @State private var selectedItem: PhotosPickerItem?
    @State private var originalImage: UIImage?
    
    // カメラ用
    @State private var isShowingCamera = false
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    
                    // --- 操作ボタンエリア ---
                    HStack(spacing: 20) {
                        // 1. カメラボタン
                        Button(action: { isShowingCamera = true }) {
                            VStack {
                                Image(systemName: "camera.fill")
                                    .font(.largeTitle)
                                Text("カメラで撮影")
                                    .font(.caption)
                            }
                            .frame(width: 120, height: 100)
                            .background(Color.blue.opacity(0.1))
                            .cornerRadius(10)
                        }
                        
                        // 2. アルバムから選択ボタン
                        PhotosPicker(selection: $selectedItem, matching: .images) {
                            VStack {
                                Image(systemName: "photo.on.rectangle")
                                    .font(.largeTitle)
                                Text("アルバム選択")
                                    .font(.caption)
                            }
                            .frame(width: 120, height: 100)
                            .background(Color.green.opacity(0.1))
                            .cornerRadius(10)
                        }
                    }
                    
                    // --- 画像表示 & ドロップエリア ---
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [5]))
                            .foregroundStyle(.gray)
                            .frame(height: 250)
                            .background(Color.gray.opacity(0.05))
                        
                        if let originalImage {
                            Image(uiImage: originalImage)
                                .resizable()
                                .scaledToFit()
                                .frame(height: 240)
                                .cornerRadius(10)
                        } else {
                            VStack {
                                Image(systemName: "arrow.down.doc")
                                    .font(.largeTitle)
                                    .foregroundStyle(.gray)
                                Text("ここに画像をドラッグ＆ドロップ\n(シミュレータ用)")
                                    .multilineTextAlignment(.center)
                                    .foregroundStyle(.gray)
                            }
                        }
                    }
                    .onDrop(of: [.image], isTargeted: nil) { providers in
                        loadFromDrop(providers: providers)
                        return true
                    }
                    
                    // --- 解析結果の表示 ---
                    if scanner.isProcessing {
                        ProgressView("AIが解析中...")
                            .padding()
                    } else if !scanner.croppedImages.isEmpty {
                        Divider()
                        Text("検出成功！ \(scanner.croppedImages.count)枚")
                            .font(.headline)
                            .foregroundStyle(.green)
                        
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: 10) {
                            ForEach(scanner.croppedImages, id: \.self) { img in
                                Image(uiImage: img)
                                    .resizable()
                                    .scaledToFit()
                                    .frame(height: 120)
                                    .cornerRadius(5)
                                    .shadow(radius: 2)
                            }
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("画像取り込みテスト")
            // カメラ画面の呼び出し
            .sheet(isPresented: $isShowingCamera) {
                CameraPicker(selectedImage: $originalImage)
            }
            // アルバム選択時の処理
            .onChange(of: selectedItem) {
                Task {
                    if let data = try? await selectedItem?.loadTransferable(type: Data.self),
                       let uiImage = UIImage(data: data) {
                        // ★修正点：ここでもリサイズする
                        let resized = uiImage.resizeTo(width: 1080)
                        self.originalImage = resized
                        scanner.detectAndCrop(image: resized)
                    }
                }
            }
            // 画像が入った瞬間に解析開始
            .onChange(of: originalImage) {
                if let img = originalImage {
                    scanner.detectAndCrop(image: img)
                }
            }
        }
    }
    
    // ドロップされた画像を処理する機能
    private func loadFromDrop(providers: [NSItemProvider]) {
        if let provider = providers.first(where: { $0.canLoadObject(ofClass: UIImage.self) }) {
            provider.loadObject(ofClass: UIImage.self) { image, _ in
                DispatchQueue.main.async {
                    if let uiImage = image as? UIImage {
                        // ★修正点：ドロップ時もリサイズ
                        self.originalImage = uiImage.resizeTo(width: 1080)
                    }
                }
            }
        }
    }
}

// --- カメラ機能 & 画像リサイズ機能 ---

struct CameraPicker: UIViewControllerRepresentable {
    @Binding var selectedImage: UIImage?
    @Environment(\.dismiss) private var dismiss
    
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            picker.sourceType = .camera
        }
        picker.delegate = context.coordinator
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }
    
    class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let parent: CameraPicker
        init(parent: CameraPicker) { self.parent = parent }
        
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            if let image = info[.originalImage] as? UIImage {
                // ★重要：ここで画像を小さくリサイズしてから渡す！
                // これでメモリ不足によるフリーズを防ぎます
                parent.selectedImage = image.resizeTo(width: 1080)
            }
            parent.dismiss()
        }
        
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

// ★便利機能：画像をリサイズする魔法のコード
extension UIImage {
    func resizeTo(width: CGFloat) -> UIImage {
        let scale = width / self.size.width
        let newHeight = self.size.height * scale
        let newSize = CGSize(width: width, height: newHeight)
        
        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in
            self.draw(in: CGRect(origin: .zero, size: newSize))
        }
    }
}
