import Foundation
import SwiftData

// 1. 年度
@Model
class YearCategory {
    var year: Int
    @Relationship(deleteRule: .cascade) var groups: [PhotoGroup] = []
    init(year: Int) { self.year = year }
}

// 2. グループ（月/イベント）
@Model
class PhotoGroup {
    var title: String
    var createdDate: Date
    @Relationship(deleteRule: .cascade) var photoSets: [PhotoSet] = []
    var yearCategory: YearCategory?
    init(title: String, createdDate: Date = Date()) {
        self.title = title
        self.createdDate = createdDate
    }
}

// 3. セット（衣装）
@Model
class PhotoSet {
    var name: String
    var isFivePoses: Bool
    @Relationship(deleteRule: .cascade) var photos: [Photo] = []
    var photoGroup: PhotoGroup?
    init(name: String, isFivePoses: Bool = false) {
        self.name = name
        self.isFivePoses = isFivePoses
    }
}

// 4. 写真（ヨリ/チュウ/ヒキ）
@Model
class Photo {
    var pose: String
    var isOwned: Bool = false
    @Attribute(.externalStorage) var imageData: Data?
    var photoSet: PhotoSet?
    init(pose: String, isOwned: Bool = false, imageData: Data? = nil) {
        self.pose = pose
        self.isOwned = isOwned
        self.imageData = imageData
    }
}
