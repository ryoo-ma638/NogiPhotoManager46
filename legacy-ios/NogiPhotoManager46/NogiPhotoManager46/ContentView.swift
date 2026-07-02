import SwiftUI
import SwiftData

struct ContentView: View {
    // 年度の新しい順（降順）に並び替えて取得
    @Query(sort: \YearCategory.year, order: .reverse) private var years: [YearCategory]
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        NavigationStack {
            List {
                ForEach(years) { year in
                    // タップしたら GroupListView（月・イベント一覧）へ移動
                    NavigationLink(destination: GroupListView(yearCategory: year)) {
                        HStack {
                            Image(systemName: "folder.fill")
                                .foregroundStyle(.yellow)
                            Text(String(year.year) + "年")
                                .font(.headline)
                        }
                    }
                }
                .onDelete(perform: deleteYears) // スワイプで削除可能に
            }
            .navigationTitle("弓木奈於 生写真")
            .toolbar {
                            ToolbarItem(placement: .navigationBarTrailing) {
                                HStack {
                                    // ★新しく追加：テスト画面へ
                                    NavigationLink(destination: ScanTestView()) {
                                        Image(systemName: "camera.viewfinder")
                                    }
                                    
                                    Button(action: addYear) {
                                        Label("追加", systemImage: "plus")
                                    }
                                }
                            }
                        }
        }
    }

    // 最新の年の「次の年」を自動で追加する機能
    private func addYear() {
        // 今あるリストの中で一番新しい年を探す（なければ2024スタート）
        let newestYear = years.first?.year ?? 2024
        let newYearCategory = YearCategory(year: newestYear + 1)
        modelContext.insert(newYearCategory)
    }

    // 削除機能
    private func deleteYears(offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(years[index])
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(for: YearCategory.self, inMemory: true)
}
