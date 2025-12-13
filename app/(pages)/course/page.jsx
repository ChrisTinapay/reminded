import CourseHeader from './_components/courseHeader';
import CourseMetrics from './_components/courseMetrics';
import CourseCTAContainer from './_components/courseCTAContainer';

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
