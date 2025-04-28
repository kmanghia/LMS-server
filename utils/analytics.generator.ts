import { Document, Model } from "mongoose";

interface MonthData {
  month: string;
  count: number;
}

export async function generateLast12MothsData<T extends Document>(
  model: Model<T>,
  timeField: string = "createdAt"
): Promise<{ last12Months: MonthData[] }> {
  // Lấy tất cả dữ liệu từ cơ sở dữ liệu
  const allRecords = await model.find().select(timeField).lean();
  console.log("Total records:", allRecords.length);
  
  if (allRecords.length > 0) {
    console.log("Sample record:", JSON.stringify(allRecords[0]));
  }

  // Khởi tạo map để đếm số bản ghi theo ngày
  const countByDate: Record<string, number> = {};

  // Đếm số bản ghi cho từng ngày
  for (const record of allRecords) {
    // Lấy giá trị trường thời gian
    const rawDate = (record as any)[timeField];
    
    // Parse thành Date object
    let date: Date;
    if (typeof rawDate === 'string') {
      date = new Date(rawDate);
    } else if (rawDate instanceof Date) {
      date = rawDate;
    } else {
      console.log("Unknown date format:", rawDate);
      continue;
    }
    
    // Format ngày theo "YYYY-MM-DD" để dễ sắp xếp
    const formattedDate = date.toISOString().split('T')[0];
    
    // In log debug nếu là ngày đặc biệt
    if (formattedDate === '2025-03-20' || formattedDate === '2025-04-04') {
      console.log(`Found date ${formattedDate} from value:`, rawDate);
    }
    
    if (!countByDate[formattedDate]) {
      countByDate[formattedDate] = 0;
    }
    countByDate[formattedDate]++;
  }

  console.log("Count by date:", countByDate);

  // Chuyển từ map thành mảng và sắp xếp theo ngày
  const sortedData = Object.entries(countByDate).map(([date, count]) => {
    return { date, count };
  }).sort((a, b) => a.date.localeCompare(b.date));

  console.log("Sorted data:", sortedData);

  // Định dạng lại ngày từ "YYYY-MM-DD" thành "DD/MM/YYYY" cho hiển thị
  const last12Months = sortedData.map(item => {
    const [year, month, day] = item.date.split('-');
    const displayDate = `${day}/${month}/${year}`;
    
    return {
      month: displayDate,
      count: item.count
    };
  });

  console.log("Final result:", last12Months);

  return { last12Months };
}
