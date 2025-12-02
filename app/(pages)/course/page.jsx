import CourseHeader from './_components/CourseHeader';
import CourseMetrics from './_components/CourseMetrics';
import CourseCTAContainer from './_components/CourseCTAContainer';

const Course = () => {
  return (
    <div className="flex flex-col justify-center items-center gap-8 p-6">
      <CourseHeader />
      <div className="flex flex-col gap-6 py-6 self-stretch items-center justify-center">
        <CourseMetrics />
        <CourseCTAContainer />
      </div>
    </div>
  );
};

export default Course;
