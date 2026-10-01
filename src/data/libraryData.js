// Central data store for the LibraryOS app

export const books = [
  { id: 1, title: 'To Kill a Mockingbird', author: 'Harper Lee', isbn: '9780061935466', genre: 'Fiction', copies: 4, available: 2 },
  { id: 2, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', isbn: '9780743273565', genre: 'Fiction', copies: 3, available: 1 },
  { id: 3, title: 'A Brief History of Time', author: 'Stephen Hawking', isbn: '9780553380163', genre: 'Science', copies: 2, available: 2 },
  { id: 4, title: 'The Alchemist', author: 'Paulo Coelho', isbn: '9780062315007', genre: 'Philosophy', copies: 5, available: 3 },
  { id: 5, title: 'Sapiens', author: 'Yuval Noah Harari', isbn: '9780062316097', genre: 'History', copies: 3, available: 0 },
  { id: 6, title: 'Introduction to Algorithms', author: 'Cormen et al.', isbn: '9780262033848', genre: 'Computer Science', copies: 4, available: 2 },
  { id: 7, title: 'The Diary of a Young Girl', author: 'Anne Frank', isbn: '9780553577129', genre: 'Biography', copies: 3, available: 3 },
  { id: 8, title: '1984', author: 'George Orwell', isbn: '9780451524935', genre: 'Fiction', copies: 4, available: 1 },
  { id: 9, title: 'Atomic Habits', author: 'James Clear', isbn: '9780735211292', genre: 'Self-Help', copies: 3, available: 2 },
  { id: 10, title: 'The Hunger Games', author: 'Suzanne Collins', isbn: '9780439023481', genre: 'Fiction', copies: 2, available: 0 },
];

export const members = [
  { id: 1, name: 'Arjun Sharma', email: 'arjun.sharma@school.edu', rollNo: 'CS-2024-001', class: '12-A', contact: '9876543210', joined: '2024-01-05' },
  { id: 2, name: 'Priya Patel', email: 'priya.patel@school.edu', rollNo: 'CS-2024-002', class: '12-A', contact: '9876543211', joined: '2024-01-06' },
  { id: 3, name: 'Rahul Gupta', email: 'rahul.gupta@school.edu', rollNo: 'CS-2024-015', class: '11-B', contact: '9876543212', joined: '2024-01-08' },
  { id: 4, name: 'Sneha Reddy', email: 'sneha.reddy@school.edu', rollNo: 'CS-2024-031', class: '11-C', contact: '9876543213', joined: '2024-01-09' },
  { id: 5, name: 'Vikram Joshi', email: 'vikram.joshi@school.edu', rollNo: 'CS-2024-047', class: '10-A', contact: '9876543214', joined: '2024-01-10' },
  { id: 6, name: 'Aisha Khan', email: 'aisha.khan@school.edu', rollNo: 'CS-2024-062', class: '10-B', contact: '9876543215', joined: '2024-01-12' },
];

export const loans = [
  { id: 1, book: 'The Hunger Games', bookAuthor: 'Suzanne Collins', member: 'Vikram Joshi', rollNo: 'CS-2024-047', issueDate: '2026-09-20', dueDate: '2026-10-04', returned: null, status: 'Issued', fine: null },
  { id: 2, book: 'The Great Gatsby', bookAuthor: 'F. Scott Fitzgerald', member: 'Priya Patel', rollNo: 'CS-2024-002', issueDate: '2026-09-18', dueDate: '2026-10-02', returned: null, status: 'Issued', fine: null },
  { id: 3, book: '1984', bookAuthor: 'George Orwell', member: 'Sneha Reddy', rollNo: 'CS-2024-031', issueDate: '2026-09-13', dueDate: '2026-09-27', returned: null, status: 'Issued', fine: null },
  { id: 4, book: 'Sapiens', bookAuthor: 'Yuval Noah Harari', member: 'Rahul Gupta', rollNo: 'CS-2024-015', issueDate: '2026-09-05', dueDate: '2026-09-19', returned: null, status: 'Overdue', fine: '₹8' },
  { id: 5, book: 'To Kill a Mockingbird', bookAuthor: 'Harper Lee', member: 'Arjun Sharma', rollNo: 'CS-2024-001', issueDate: '2026-09-03', dueDate: '2026-09-17', returned: null, status: 'Overdue', fine: '₹12' },
  { id: 6, book: 'To Kill a Mockingbird', bookAuthor: 'Harper Lee', member: 'Aisha Khan', rollNo: 'CS-2024-062', issueDate: '2026-08-24', dueDate: '2026-09-07', returned: '2026-09-05', status: 'Returned', fine: null },
  { id: 7, book: 'Sapiens', bookAuthor: 'Yuval Noah Harari', member: 'Priya Patel', rollNo: 'CS-2024-002', issueDate: '2026-08-09', dueDate: '2026-08-23', returned: '2026-08-24', status: 'Returned', fine: null },
  { id: 8, book: 'The Alchemist', bookAuthor: 'Paulo Coelho', member: 'Arjun Sharma', rollNo: 'CS-2024-001', issueDate: '2026-07-25', dueDate: '2026-08-08', returned: '2026-08-09', status: 'Returned', fine: null },
];

export const monthlyIssues = [
  { month: 'Apr', count: 0 },
  { month: 'May', count: 0 },
  { month: 'Jun', count: 0 },
  { month: 'Jul', count: 1 },
  { month: 'Aug', count: 2 },
  { month: 'Sept', count: 5 },
];

export const genreColors = {
  Biography: '#7C3AED',
  'Computer Science': '#10B981',
  Fiction: '#F59E0B',
  History: '#EF4444',
  Philosophy: '#8B5CF6',
  Science: '#06B6D4',
  'Self-Help': '#F97316',
};

export const mostBorrowed = [
  { title: 'To Kill a Mockingb...', count: 8 },
  { title: 'Sapiens', count: 7 },
  { title: 'The Great Gatsby', count: 6 },
  { title: '1984', count: 5 },
  { title: 'The Hunger Games', count: 4 },
];

export const recentActivity = [
  { book: 'The Hunger Games', action: 'Issued', date: '2026-09-20' },
  { book: 'The Great Gatsby', action: 'Issued', date: '2026-09-18' },
];

export const currentlyIssued = [
  { book: 'To Kill a Mockingbird', member: 'Arjun Sharma', due: '2026-09-17', overdueDays: 12 },
  { book: 'The Great Gatsby', member: 'Priya Patel', due: '2026-10-02', overdueDays: null },
  { book: 'Sapiens', member: 'Rahul Gupta', due: '2026-09-19', overdueDays: 8 },
  { book: '1984', member: 'Sneha Reddy', due: '2026-09-27', overdueDays: null },
  { book: 'The Hunger Games', member: 'Vikram Joshi', due: '2026-10-04', overdueDays: null },
];
