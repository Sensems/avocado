import { Sidebar } from './components/Sidebar/Sidebar';
import useUserStore from '@/stores/userStore';
import LoginModal from '@/components/LoginModal/LoginModal';

const Home: React.FC = () => {
  const { isShowLoginPanel, setShowLoginPanel } = useUserStore()
  return (
    <div className="flex h-screen css-var-ant">
      <Sidebar />
      <div className='flex-1'>
        111
      </div>

      <LoginModal
        visible={isShowLoginPanel}
        onClose={() => setShowLoginPanel(false)}
        onLoginSuccess={() => setShowLoginPanel(false)}
      />
    </div>
  );
}
 
export default Home;