-- =====================================================
-- BANGLADESH EDUCATION INSTITUTIONS
-- Top Schools/Colleges by Education Board
-- =====================================================

-- Drop if exists and recreate
DROP TABLE IF EXISTS education_institutions;

CREATE TABLE education_institutions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    board_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    name_bn VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    institution_type ENUM('School', 'College', 'School & College', 'Madrasah') DEFAULT 'School & College',
    eiin VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES education_boards(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create index for faster lookups
CREATE INDEX idx_institution_board ON education_institutions(board_id);

-- DHAKA BOARD (ID: 1) - Top 10 Institutions
INSERT INTO education_institutions (board_id, name, name_bn, institution_type) VALUES
(1, 'Notre Dame College', 'নটর ডেম কলেজ', 'College'),
(1, 'Dhaka College', 'ঢাকা কলেজ', 'College'),
(1, 'Viqarunnisa Noon School & College', 'ভিকারুননিসা নূন স্কুল এন্ড কলেজ', 'School & College'),
(1, 'Rajuk Uttara Model College', 'রাজউক উত্তরা মডেল কলেজ', 'School & College'),
(1, 'Holy Cross College', 'হলিক্রস কলেজ', 'College'),
(1, 'Dhaka Residential Model College', 'ঢাকা রেসিডেন্সিয়াল মডেল কলেজ', 'School & College'),
(1, 'Government Laboratory High School', 'সরকারি ল্যাবরেটরি হাই স্কুল', 'School'),
(1, 'Ideal School and College', 'আইডিয়াল স্কুল এন্ড কলেজ', 'School & College'),
(1, 'Motijheel Government Boys High School', 'মতিঝিল সরকারি বালক উচ্চ বিদ্যালয়', 'School'),
(1, 'St. Joseph Higher Secondary School', 'সেন্ট জোসেফ উচ্চ মাধ্যমিক বিদ্যালয়', 'School & College');

-- CHITTAGONG BOARD (ID: 2) - Top 7 Institutions
INSERT INTO education_institutions (board_id, name, name_bn, institution_type) VALUES
(2, 'Chittagong College', 'চট্টগ্রাম কলেজ', 'College'),
(2, 'Chittagong Government High School', 'চট্টগ্রাম সরকারি উচ্চ বিদ্যালয়', 'School'),
(2, 'Dr. Khastagir Government Girls High School', 'ডঃ খাস্তগীর সরকারি বালিকা উচ্চ বিদ্যালয়', 'School'),
(2, 'Chittagong Collegiate School', 'চট্টগ্রাম কলেজিয়েট স্কুল', 'School'),
(2, 'BAF Shaheen College Chittagong', 'বিএএফ শাহীন কলেজ চট্টগ্রাম', 'School & College'),
(2, 'Cantonment Public School and College', 'ক্যান্টনমেন্ট পাবলিক স্কুল এন্ড কলেজ', 'School & College'),
(2, 'Faujdarhat Cadet College', 'ফৌজদারহাট ক্যাডেট কলেজ', 'School & College');

-- RAJSHAHI BOARD (ID: 3) - Top 6 Institutions
INSERT INTO education_institutions (board_id, name, name_bn, institution_type) VALUES
(3, 'Rajshahi College', 'রাজশাহী কলেজ', 'College'),
(3, 'Rajshahi Collegiate School', 'রাজশাহী কলেজিয়েট স্কুল', 'School'),
(3, 'Rajshahi Government Girls High School', 'রাজশাহী সরকারি বালিকা উচ্চ বিদ্যালয়', 'School'),
(3, 'P.N. Government Girls High School', 'পি.এন. সরকারি বালিকা উচ্চ বিদ্যালয়', 'School'),
(3, 'Rajshahi Cadet College', 'রাজশাহী ক্যাডেট কলেজ', 'School & College'),
(3, 'New Government Degree College', 'নিউ গভর্নমেন্ট ডিগ্রী কলেজ', 'College');

-- JESSORE BOARD (ID: 4) - Top 5 Institutions
INSERT INTO education_institutions (board_id, name, name_bn, institution_type) VALUES
(4, 'Jessore Government M.M. College', 'যশোর সরকারি এম.এম. কলেজ', 'College'),
(4, 'Jessore Zilla School', 'যশোর জিলা স্কুল', 'School'),
(4, 'Jessore Government Girls High School', 'যশোর সরকারি বালিকা উচ্চ বিদ্যালয়', 'School'),
(4, 'Khulna Zilla School', 'খুলনা জিলা স্কুল', 'School'),
(4, 'Khulna Government Womens College', 'খুলনা সরকারি মহিলা কলেজ', 'College');

-- COMILLA BOARD (ID: 5) - Top 5 Institutions
INSERT INTO education_institutions (board_id, name, name_bn, institution_type) VALUES
(5, 'Comilla Victoria Government College', 'কুমিল্লা ভিক্টোরিয়া সরকারি কলেজ', 'College'),
(5, 'Comilla Zilla School', 'কুমিল্লা জিলা স্কুল', 'School'),
(5, 'Comilla Government Womens College', 'কুমিল্লা সরকারি মহিলা কলেজ', 'College'),
(5, 'Comilla Cadet College', 'কুমিল্লা ক্যাডেট কলেজ', 'School & College'),
(5, 'Feni Government College', 'ফেনী সরকারি কলেজ', 'College');

-- SYLHET BOARD (ID: 6) - Top 5 Institutions
INSERT INTO education_institutions (board_id, name, name_bn, institution_type) VALUES
(6, 'MC College, Sylhet', 'এমসি কলেজ, সিলেট', 'College'),
(6, 'Sylhet Government Pilot High School', 'সিলেট সরকারি পাইলট উচ্চ বিদ্যালয়', 'School'),
(6, 'Sylhet Cadet College', 'সিলেট ক্যাডেট কলেজ', 'School & College'),
(6, 'Sylhet Government Womens College', 'সিলেট সরকারি মহিলা কলেজ', 'College'),
(6, 'Jalalabad Cantonment Public School', 'জালালাবাদ ক্যান্টনমেন্ট পাবলিক স্কুল', 'School & College');

-- DINAJPUR BOARD (ID: 7) - Top 5 Institutions
INSERT INTO education_institutions (board_id, name, name_bn, institution_type) VALUES
(7, 'Dinajpur Government College', 'দিনাজপুর সরকারি কলেজ', 'College'),
(7, 'Dinajpur Zilla School', 'দিনাজপুর জিলা স্কুল', 'School'),
(7, 'Rangpur Cantonment Public School', 'রংপুর ক্যান্টনমেন্ট পাবলিক স্কুল', 'School & College'),
(7, 'Rangpur Cadet College', 'রংপুর ক্যাডেট কলেজ', 'School & College'),
(7, 'Carmichael College, Rangpur', 'কারমাইকেল কলেজ, রংপুর', 'College');

-- BARISAL BOARD (ID: 8) - Top 5 Institutions
INSERT INTO education_institutions (board_id, name, name_bn, institution_type) VALUES
(8, 'Barisal Government Womens College', 'বরিশাল সরকারি মহিলা কলেজ', 'College'),
(8, 'Barisal Zilla School', 'বরিশাল জিলা স্কুল', 'School'),
(8, 'Barisal Cadet College', 'বরিশাল ক্যাডেট কলেজ', 'School & College'),
(8, 'Government BM College', 'সরকারি বিএম কলেজ', 'College'),
(8, 'Barisal Government Girls High School', 'বরিশাল সরকারি বালিকা উচ্চ বিদ্যালয়', 'School');

-- MYMENSINGH BOARD (ID: 9) - Top 5 Institutions
INSERT INTO education_institutions (board_id, name, name_bn, institution_type) VALUES
(9, 'Ananda Mohan College', 'আনন্দ মোহন কলেজ', 'College'),
(9, 'Mymensingh Zilla School', 'ময়মনসিংহ জিলা স্কুল', 'School'),
(9, 'Mymensingh Girls Cadet College', 'ময়মনসিংহ বালিকা ক্যাডেট কলেজ', 'School & College'),
(9, 'Momenshahi Government Womens College', 'মোমেনশাহী সরকারি মহিলা কলেজ', 'College'),
(9, 'Nasirabad Government High School', 'নাসিরাবাদ সরকারি উচ্চ বিদ্যালয়', 'School');

-- MADRASAH BOARD (ID: 10) - Top 5 Institutions
INSERT INTO education_institutions (board_id, name, name_bn, institution_type) VALUES
(10, 'Jamia Qurania Arabia Lalbagh', 'জামিয়া কুরআনিয়া আরাবিয়া লালবাগ', 'Madrasah'),
(10, 'Darul Uloom Hathazari', 'দারুল উলূম হাটহাজারী', 'Madrasah'),
(10, 'Jamia Islamia Darul Uloom Dhaka', 'জামিয়া ইসলামিয়া দারুল উলূম ঢাকা', 'Madrasah'),
(10, 'Alia Madrasah Dhaka', 'আলিয়া মাদ্রাসা ঢাকা', 'Madrasah'),
(10, 'Jamia Ahmadiyya Sunnia Alia', 'জামিয়া আহমদিয়া সুন্নিয়া আলিয়া', 'Madrasah');

-- TECHNICAL BOARD (ID: 11) - Top 5 Institutions
INSERT INTO education_institutions (board_id, name, name_bn, institution_type) VALUES
(11, 'Dhaka Polytechnic Institute', 'ঢাকা পলিটেকনিক ইনস্টিটিউট', 'College'),
(11, 'Chittagong Polytechnic Institute', 'চট্টগ্রাম পলিটেকনিক ইনস্টিটিউট', 'College'),
(11, 'Rajshahi Polytechnic Institute', 'রাজশাহী পলিটেকনিক ইনস্টিটিউট', 'College'),
(11, 'Sylhet Polytechnic Institute', 'সিলেট পলিটেকনিক ইনস্টিটিউট', 'College'),
(11, 'Barisal Polytechnic Institute', 'বরিশাল পলিটেকনিক ইনস্টিটিউট', 'College');
