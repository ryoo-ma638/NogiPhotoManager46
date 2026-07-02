import SwiftUI
import SwiftData

struct GroupListView: View {
    @Bindable var yearCategory: YearCategory
    @Environment(\.modelContext) private var modelContext
    
    // 追加画面を出すためのスイッチ
    @State private var showingAddSheet = false

    var body: some View {
        List {
            ForEach(yearCategory.groups) { group in
                NavigationLink(destination: PhotoSetListView(photoGroup: group)) {
                    VStack(alignment: .leading) {
                        Text(group.title)
                            .font(.headline)
                        Text(group.createdDate.formatted(date: .numeric, time: .omitted))
                            .font(.caption)
                            .foregroundStyle(.gray)
                    }
                }
            }
            .onDelete(perform: deleteGroups)
        }
        .navigationTitle("\(String(yearCategory.year))年のフォルダ")
        .toolbar {
            Button(action: { showingAddSheet = true }) {
                Label("追加", systemImage: "folder.badge.plus")
            }
        }
        // ここがポイント：賢い入力画面を呼び出す
        .sheet(isPresented: $showingAddSheet) {
            SmartAddGroupView(yearCategory: yearCategory)
        }
    }

    private func deleteGroups(offsets: IndexSet) {
        for index in offsets {
            let group = yearCategory.groups[index]
            modelContext.delete(group)
        }
    }
}

// ▼ ここから下が「賢い入力画面」の設計図です ▼
struct SmartAddGroupView: View {
    var yearCategory: YearCategory
    @Environment(\.dismiss) private var dismiss
    
    @State private var title = ""
    @State private var selectedType = "月別"
    @State private var suggestions: [String] = [] // 候補リスト

    // 選択肢の種類
    let types = ["月別", "ライブ/イベント", "楽曲", "卒コン", "その他"]
    // 月のデータ
    let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    // メンバー辞書（簡易版）
    let members = ["秋元真夏", "齋藤飛鳥", "山下美月", "久保史緒里", "向井葉月", "矢久保美緒", "鈴木絢音", "与田祐希", "遠藤さくら", "賀喜遥香", "弓木奈於"]

    var body: some View {
        NavigationStack {
            Form {
                // 1. 種類の選択
                Section("種類の選択") {
                    Picker("種類", selection: $selectedType) {
                        ForEach(types, id: \.self) { type in
                            Text(type)
                        }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: selectedType) {
                        updateSuggestions() // 種類を変えたら候補も更新
                    }
                }

                // 2. 入力と候補表示
                Section("タイトル入力") {
                    TextField(placeholderText(), text: $title)
                        .onChange(of: title) {
                            updateSuggestions() // 文字を打つたびに候補を更新
                        }

                    // 候補があればリスト表示（タップで入力完了）
                    if !suggestions.isEmpty {
                        List {
                            ForEach(suggestions, id: \.self) { suggestion in
                                Button(action: {
                                    title = suggestion
                                    suggestions = [] // 確定したら候補を消す
                                }) {
                                    HStack {
                                        IconForType(type: selectedType)
                                        Text(suggestion).foregroundStyle(.primary)
                                        Spacer()
                                        Text("候補").font(.caption).foregroundStyle(.gray)
                                    }
                                }
                            }
                        }
                        .frame(minHeight: 150) // 候補リストの高さ確保
                    }
                }
            }
            .navigationTitle("フォルダ追加")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("キャンセル") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("追加") {
                        addGroup()
                        dismiss()
                    }
                    .disabled(title.isEmpty)
                }
            }
            .onAppear {
                updateSuggestions() // 画面が開いた瞬間にも候補を出す
            }
        }
    }

    // 文字入力に合わせて「気の利いた候補」を作るロジック
    private func updateSuggestions() {
        suggestions = []
        
        if selectedType == "月別" {
            // 入力文字が含まれる月だけ残す（空なら全部出す）
            if title.isEmpty {
                suggestions = months
            } else {
                suggestions = months.filter { $0.localizedCaseInsensitiveContains(title) }
            }
        }
        else if selectedType == "卒コン" {
            // 「久保」と打ったら「久保史緒里 卒業コンサート」などを提案
            if title.isEmpty {
                // 何も打ってないときは「最近卒業しそうな人」や例を出してもいいが、今は空にしておく
            } else {
                // 入力された文字を含むメンバーを探す
                let hitMembers = members.filter { $0.contains(title) }
                // そのメンバー名を使って「〇〇 卒業コンサート」という候補を作る
                suggestions = hitMembers.map { "\($0) 卒業コンサート" }
            }
        }
        else if selectedType == "ライブ/イベント" {
            let events = ["13th YEAR BIRTHDAY LIVE", "真夏の全国ツアー2025"]
            if title.isEmpty {
                suggestions = events
            } else {
                suggestions = events.filter { $0.contains(title) }
            }
        }
    }
    
    // 入力欄のプレヒント文字
    private func placeholderText() -> String {
        switch selectedType {
        case "月別": return "January"
        case "卒コン": return "メンバー名を入力（例：久保）"
        case "楽曲": return "曲名を入力"
        default: return "タイトルを入力"
        }
    }
    
    // アイコン出し分け
    private func IconForType(type: String) -> some View {
        switch type {
        case "月別": return Image(systemName: "calendar")
        case "卒コン": return Image(systemName: "person.fill.turn.right")
        default: return Image(systemName: "music.note")
        }
    }

    // データ保存
    private func addGroup() {
        let newGroup = PhotoGroup(title: title)
        yearCategory.groups.append(newGroup)
    }
}
