import SwiftUI
import SwiftData

struct PhotoSetListView: View {
    @Bindable var photoGroup: PhotoGroup
    @Environment(\.modelContext) private var modelContext
    
    // 賢い追加画面を出すスイッチ
    @State private var showingAddSheet = false

    var body: some View {
        List {
            ForEach(photoGroup.photoSets) { set in
                // タップしたら詳細（個別の写真リスト）へ飛ぶ（※次はここを作ります）
                NavigationLink(destination: Text("写真一覧画面（開発中）")) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text(set.name)
                                .font(.body.bold())
                            if set.isFivePoses {
                                Text("全5種（座りあり）")
                                    .font(.caption)
                                    .foregroundStyle(.purple)
                            } else {
                                Text("全3種")
                                    .font(.caption)
                                    .foregroundStyle(.gray)
                            }
                        }
                        Spacer()
                    }
                }
            }
            .onDelete(perform: deleteSets)
        }
        .navigationTitle(photoGroup.title)
        .toolbar {
            Button(action: { showingAddSheet = true }) {
                Label("追加", systemImage: "plus")
            }
        }
        .sheet(isPresented: $showingAddSheet) {
            SmartAddSetView(photoGroup: photoGroup)
        }
    }

    private func deleteSets(offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(photoGroup.photoSets[index])
        }
    }
}

// ▼ ここから下が「賢い衣装追加画面」 ▼
struct SmartAddSetView: View {
    var photoGroup: PhotoGroup
    @Environment(\.dismiss) private var dismiss
    
    @State private var inputName = ""
    @State private var isFivePoses = false
    @State private var selectedCategory = "通常"
    
    // カテゴリ定義
    let categories = ["通常", "MV", "季節/イベント", "ライブT"]

    var body: some View {
        NavigationStack {
            Form {
                // 1. カテゴリ選択
                Section {
                    Picker("カテゴリ", selection: $selectedCategory) {
                        ForEach(categories, id: \.self) { cat in
                            Text(cat)
                        }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: selectedCategory) {
                        applyAutoLogic() // カテゴリ変えたら設定を自動変更
                    }
                }
                
                // 2. 名前入力
                Section("衣装名 / 曲名") {
                    TextField(placeholderText(), text: $inputName)
                        .onChange(of: inputName) {
                            applyAutoLogic() // 文字打つたびに判定
                        }
                    
                    if selectedCategory == "MV" {
                        Text("※ 曲名を入力すると自動で「MV衣装」と付きます")
                            .font(.caption)
                            .foregroundStyle(.gray)
                    }
                }
                
                // 3. 5種かどうかの設定（自動判定されるが手動でも変えられる）
                Section {
                    Toggle("5種セット（座りヨリ/ヒキあり）", isOn: $isFivePoses)
                } header: {
                    Text("構成設定")
                } footer: {
                    if isFivePoses {
                        Text("バレンタイン、ハロウィン、MVなどは通常5種です。")
                    }
                }
            }
            .navigationTitle("衣装セット追加")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        addSet()
                        dismiss()
                    }
                    .disabled(inputName.isEmpty)
                }
            }
        }
    }
    
    // 入力ヒント
    private func placeholderText() -> String {
        switch selectedCategory {
        case "MV": return "曲名を入力（例：おひとりさま天国）"
        case "季節/イベント": return "イベント名（例：バレンタイン）"
        default: return "衣装名（例：スペシャル衣装34）"
        }
    }
    
    // ★ここがAIっぽいロジック（自動判定）
    private func applyAutoLogic() {
        // MVモードなら無条件で5種
        if selectedCategory == "MV" {
            isFivePoses = true
        }
        // 特定のキーワードが入っていたら5種にする
        else if inputName.contains("バレンタイン") ||
                inputName.contains("ハロウィン") ||
                inputName.contains("浴衣") ||
                inputName.contains("福袋") {
            isFivePoses = true
        }
        // それ以外は3種に戻す（手動でONにした場合を除く）
        else {
            // 一旦リセットしたい場合は false にするが、
            // ユーザーが手動でONにしたのを勝手に消さないよう、ここは緩くしておく
            if selectedCategory == "ライブT" || selectedCategory == "通常" {
                 // 通常は3種推奨
                 // isFivePoses = false // ※あえて強制はしないでおく
            }
        }
    }
    
    // 保存処理
    private func addSet() {
        var finalName = inputName
        // MVの場合は「〇〇 MV」という名前に整形してあげる
        if selectedCategory == "MV" && !inputName.contains("MV") {
            finalName = "\(inputName) MV"
        }
        
        let newSet = PhotoSet(name: finalName, isFivePoses: isFivePoses)
        photoGroup.photoSets.append(newSet)
        
        // ★次回、ここで「3種ならヨリチュウヒキ」「5種なら＋座り」の空データを自動生成する処理を入れます
    }
}
